// Batch orchestrator (FR5, AC-6): turns one XREADGROUP batch into resource rows
// and the set of stream ids that are safe to XACK. The resource pipeline per
// message is: extract URLs → discard if none → per URL: SSRF-guarded fetch →
// AI enrich (message-text-only fallback on fetch failure) → embed all of the
// message's `title\n\ndescription` texts in one call → persist + stamp in one
// transaction.
//
// AD-13 made concrete: an id is returned for XACK only after its row(s) are
// stamped `indexed_at` inside a COMMITted tx (RETURNING-gated) — or, for a
// no-URL/all-blocked message, after the SAME stamp with zero rows (D2/discard).
// An enrichment or embedding hard failure for the message leaves it un-ACKed
// entirely (D1) — no partial persistence; later messages still run.
import type { HivlyConfig } from '@hivly/shared';
import { discordMessages, embeddings, inArray, sql } from '@hivly/shared/db';
import type { Database } from '@hivly/shared/db';
import { assertEmbeddingDimensions } from '@hivly/shared/providers';

import { buildEmbeddingText, enrich, type EnrichmentChatModel } from '../enrichment/enrich.js';
import { extractPageHints } from '../enrichment/htmlText.js';
import type { GuardedDispatcher } from '../enrichment/ssrfGuard.js';
import { fetchUrl } from '../enrichment/urlFetcher.js';
import { extractUrls } from '../enrichment/extractUrls.js';
import type { Logger } from '../logger.js';
import { parseCreatedEvent } from './events.js';
import { partitionByIndexState } from './partition.js';
import type { Embedder, IndexStateRow, ParsedEntry, RawStreamEntry } from './types.js';

export interface IndexBatchDeps {
  entries: RawStreamEntry[];
  db: Database;
  embedder: Embedder;
  config: HivlyConfig;
  logger: Logger;
  /** The enrichment chat model — built once at boot, injected (AC-6, mirrors
   *  the `embedder` injection pattern; never constructed here). */
  enrichModel: EnrichmentChatModel;
  /** The SSRF-guarded dispatcher — built once at boot, injected (AC-2/AC-6). */
  guard: GuardedDispatcher;
  /** Aborted on SIGTERM/SIGINT — checked between messages/URLs so a shutdown
   *  never lets a partially-processed message get falsely stamped complete. */
  signal: AbortSignal;
}

export interface IndexBatchResult {
  /** Stream ids safe to XACK: malformed entries, already-indexed entries, and
   *  entries whose row(s) were stamped `indexed_at` in a committed tx this pass. */
  ackIds: string[];
}

interface ResourceRow {
  urlIndex: number;
  title: string;
  description: string;
  link: string;
}

type MessageOutcome = { kind: 'discard' } | { kind: 'rows'; rows: ResourceRow[] };

/**
 * Process one message's content into either a discard (no URLs / all blocked)
 * or the set of resource rows to persist. Throws on an enrichment hard failure
 * for ANY of the message's URLs — the whole message is a processing failure
 * (D1); the caller leaves it entirely un-ACKed. `fetchUrl`/`enrich` never throw
 * on their own account (typed outcomes / {@link EnrichmentError}), so a throw
 * here always means enrichment failed.
 */
async function processMessage(
  content: string,
  deps: Pick<IndexBatchDeps, 'config' | 'enrichModel' | 'guard' | 'signal'>,
): Promise<MessageOutcome> {
  const { config, enrichModel, guard, signal } = deps;
  const urls = extractUrls(content, config.enrichment.fetch.allowed_schemes);
  if (urls.length === 0) return { kind: 'discard' };

  const rows: ResourceRow[] = [];
  for (let urlIndex = 0; urlIndex < urls.length; urlIndex++) {
    if (signal.aborted) {
      throw new Error('aborted while processing message URLs — leaving entry un-ACKed for replay');
    }

    const url = urls[urlIndex];
    const outcome = await fetchUrl(url, config.enrichment.fetch, guard, signal);

    if (!outcome.ok && (outcome.reason === 'ssrf_blocked' || outcome.reason === 'scheme_disallowed')) {
      continue; // D2: skip this URL entirely — no row, not a failure.
    }

    const pageHints = outcome.ok ? extractPageHints(outcome.body, outcome.contentType) : null;
    const result = await enrich(
      enrichModel,
      { messageText: content, pageHints, language: config.enrichment.language },
      signal,
    );

    rows.push({ urlIndex, title: result.title, description: result.description, link: url });
  }

  if (rows.length === 0) return { kind: 'discard' }; // D2's all-blocked case converges here.
  return { kind: 'rows', rows };
}

/**
 * One tx per message: UPSERT every resource row by `chunk_key`, then stamp
 * `indexed_at`. `rows`/`vectors` may be empty (the discard path) — the stamp
 * still gates on the SAME RETURNING check. Returns whether the stamp actually
 * touched the row (AD-13, no ack if it vanished between the dedup SELECT and
 * the stamp).
 */
async function persistMessage(
  db: Database,
  messageId: string,
  channelId: string,
  rows: ResourceRow[],
  vectors: number[][],
): Promise<boolean> {
  return db.transaction(async (tx) => {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      await tx
        .insert(embeddings)
        .values({
          chunkKey: `${messageId}:${row.urlIndex}`,
          title: row.title,
          description: row.description,
          link: row.link,
          embedding: vectors[i],
          channelId,
          messageIds: [messageId],
        })
        .onConflictDoUpdate({
          target: embeddings.chunkKey,
          set: {
            title: sql`excluded.title`,
            description: sql`excluded.description`,
            link: sql`excluded.link`,
            embedding: sql`excluded.embedding`,
            channelId: sql`excluded.channel_id`,
            messageIds: sql`excluded.message_ids`,
          },
        });
    }

    const stamped = await tx
      .update(discordMessages)
      .set({ indexedAt: sql`now()` })
      .where(inArray(discordMessages.id, [messageId]))
      .returning({ id: discordMessages.id });

    return stamped.length > 0;
  });
}

/**
 * Process one batch of raw stream entries. Never throws for a data/processing
 * failure — a failed message is logged and its entries are simply omitted from
 * `ackIds` so Redis redelivers them.
 */
export async function indexBatch(deps: IndexBatchDeps): Promise<IndexBatchResult> {
  const { entries, db, embedder, config, logger, enrichModel, guard, signal } = deps;
  const ackIds: string[] = [];

  // 1. Parse. Malformed / foreign-typed entries can never succeed — XACK them so
  //    they leave the PEL instead of being redelivered forever. A tombstoned
  //    (XDEL'd) PEL entry can be redelivered with `message: null` — treat it the
  //    same as any other unprocessable entry instead of throwing.
  const parsed: ParsedEntry[] = [];
  for (const entry of entries) {
    const event = entry.message == null ? null : parseCreatedEvent(entry.message);
    if (event === null) {
      logger.warn('discarding malformed, foreign, or tombstoned stream entry', {
        streamId: entry.id,
        type: entry.message?.type,
      });
      ackIds.push(entry.id);
      continue;
    }
    parsed.push({ streamId: entry.id, event });
  }

  if (parsed.length === 0) return { ackIds };

  // 2. Dedup state — ONE query over the batch's distinct message ids.
  const ids = [...new Set(parsed.map((e) => e.event.messageId))];
  const rows: IndexStateRow[] = await db
    .select({ id: discordMessages.id, indexedAt: discordMessages.indexedAt })
    .from(discordMessages)
    .where(inArray(discordMessages.id, ids));

  const { ackNow, pending, toProcess } = partitionByIndexState(parsed, rows);
  // Already-indexed → XACK + skip; row-missing → leave PENDING (no ack), retried
  // once the bot's COMMIT lands.
  ackIds.push(...ackNow);
  if (pending.length > 0) {
    logger.debug('entries pending — no discord_messages row yet, leaving un-ACKed', {
      count: pending.length,
    });
  }

  // A producer duplicate can put the SAME messageId in `toProcess` twice (up to 3x,
  // per persistMessage's documented COMMIT-race amplification). Dedup by messageId
  // BEFORE processing — keep the first occurrence for content, and remember every
  // duplicate's streamId so they all get acked once that messageId is confirmed
  // persisted.
  const seenMessageIds = new Set<string>();
  const dedupedToProcess: ParsedEntry[] = [];
  const extraStreamIdsByMessageId = new Map<string, string[]>();
  for (const parsedEntry of toProcess) {
    const { messageId } = parsedEntry.event;
    if (seenMessageIds.has(messageId)) {
      const extras = extraStreamIdsByMessageId.get(messageId) ?? [];
      extras.push(parsedEntry.streamId);
      extraStreamIdsByMessageId.set(messageId, extras);
      continue;
    }
    seenMessageIds.add(messageId);
    dedupedToProcess.push(parsedEntry);
  }

  const dimensions = config.embeddings.dimensions;

  // 3. Resource pipeline, one message at a time — never grouped/chunked (FR5).
  for (const parsedEntry of dedupedToProcess) {
    if (signal.aborted) {
      logger.debug('shutdown signal observed — bailing the rest of the batch, entries stay pending');
      break;
    }

    const { messageId, channelId, content } = parsedEntry.event;
    const extraStreamIds = extraStreamIdsByMessageId.get(messageId) ?? [];

    try {
      const outcome = await processMessage(content, { config, enrichModel, guard, signal });

      let stamped: boolean;
      if (outcome.kind === 'discard') {
        stamped = await persistMessage(db, messageId, channelId, [], []);
      } else {
        const texts = outcome.rows.map((row) => buildEmbeddingText(row.title, row.description));
        const vectors = await embedder.embedDocuments(texts);
        if (vectors.length !== texts.length) {
          throw new Error(`embedder returned ${vectors.length} vectors for ${texts.length} texts`);
        }
        for (const vector of vectors) assertEmbeddingDimensions(vector, dimensions);

        stamped = await persistMessage(db, messageId, channelId, outcome.rows, vectors);
      }

      if (stamped) {
        ackIds.push(parsedEntry.streamId, ...extraStreamIds);
      } else {
        logger.debug('message row vanished before the stamp — leaving un-ACKed', { messageId });
      }
    } catch (err) {
      logger.error('failed to index message — entry stays pending', {
        messageId,
        channelId,
        reason: err instanceof Error ? err.message : String(err),
      });
      // No ack ids for this message; later messages still run.
    }
  }

  return { ackIds };
}
