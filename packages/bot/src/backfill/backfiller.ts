// Historical backfill orchestrator (AC-1…AC-6). Drives the SAME ingestion path
// as the live listener — persistMessage, now idempotent — so backfill is a
// driver of the existing pipeline, not a second one.
//
// Rate-limit posture (AC-4): channels are processed sequentially, pages are
// throttled with an abortable ≥1 s sleep, and 429s are absorbed by discord.js's
// default REST queue (Retry-After honored because rejectOnRateLimit is never
// overridden — do NOT hand-roll 429 handling here).
//
// Failure posture (AC-5): each channel runs in its own try/catch — an unknown
// id, a missing permission, or a mid-fetch error logs one `error` line and the
// loop continues. The completed event is ALWAYS emitted after attempting all
// channels — except on shutdown abort, where not all channels were attempted
// and Redis is already being torn down.
import type { HivlyConfig } from '@hivly/shared';
import type { Database } from '@hivly/shared/db';
import type { RedisClient } from '@hivly/shared/redis';
import { STREAM_KEYS, type BackfillCompletedEvent } from '@hivly/shared/types/events';
import type { Client } from 'discord.js';

import { waitOrAbort } from '../discord/reconnect.js';
import type { Logger } from '../logger.js';
import { persistMessage, type IngestibleMessage } from '../persistence/persistMessage.js';
import { gapPages, latestPages, type FetchPage } from './pages.js';

/** AC-4: minimum pause between two history page fetches. */
const INTER_PAGE_DELAY_MS = 1_000;

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export interface BackfillDeps {
  client: Client;
  config: HivlyConfig;
  db: Database;
  redis: RedisClient;
  logger: Logger;
  /** Per-channel cursors resolved BEFORE client.login() (AC-1) — channelId → newest persisted id or null. */
  cursors: ReadonlyMap<string, string | null>;
  /** The process shutdown signal: aborts sleeps and stops the loop cleanly. */
  signal: AbortSignal;
  /** Injectable delay, defaults to setTimeout — tests pass a fake to control timing. */
  sleep?: (ms: number) => Promise<void>;
}

/**
 * Backfill every enabled channel sequentially, then publish one
 * BackfillCompletedEvent to KNOWLEDGE_EVENTS. Never throws for a single bad
 * channel; the caller catches a whole-run failure (AC-5).
 */
export async function runBackfill({
  client,
  config,
  db,
  redis,
  logger,
  cursors,
  signal,
  sleep = defaultSleep,
}: BackfillDeps): Promise<void> {
  const throttle = (): Promise<void> => waitOrAbort(sleep(INTER_PAGE_DELAY_MS), signal);
  let channelsProcessed = 0;
  let channelsFailed = 0;
  let messagesPublished = 0;

  for (const channelConfig of config.discord.channels) {
    if (!channelConfig.enabled) continue;
    if (signal.aborted) break;

    try {
      const channel = await client.channels.fetch(channelConfig.id);
      if (channel === null || !channel.isTextBased()) {
        throw new Error('channel not found or not text-based');
      }

      // Adapter boundary: wrap the real history fetch as the pure generators'
      // injected FetchPage, mapping each discord.js Message to the same
      // IngestibleMessage slice the live path uses. cache: false — do not retain
      // up to `limit` historical messages in the discord.js cache.
      const fetchPage: FetchPage<IngestibleMessage> = async (opts) => {
        const fetched = await channel.messages.fetch({ limit: 100, cache: false, ...opts });
        return [...fetched.values()].map((m) => ({
          id: m.id,
          channelId: m.channelId,
          guildId: m.guildId,
          content: m.content,
          createdAt: m.createdAt,
          editedAt: m.editedAt,
          author: { id: m.author.id, bot: m.author.bot },
        }));
      };

      const cursor = cursors.get(channelConfig.id) ?? null;
      const pages =
        cursor === null
          ? latestPages(fetchPage, config.discord.backfill.limit, { signal, throttle })
          : gapPages(fetchPage, cursor, { signal, throttle });

      let published = 0;
      for await (const page of pages) {
        for (const message of page) {
          // Same guards as the live path (AC-3), but at debug — a history full of
          // attachment-only messages must not spam the live intent-warning.
          if (config.discord.backfill.ignore_bots && message.author.bot) {
            logger.debug('backfill skip: bot author', {
              channelId: message.channelId,
              authorId: message.author.id,
            });
            continue;
          }
          if (message.content.length === 0) {
            logger.debug('backfill skip: empty content', {
              messageId: message.id,
              channelId: message.channelId,
            });
            continue;
          }
          const { inserted } = await persistMessage(message, { config, db, redis });
          // inserted=false → the row already existed (cursor-boundary overlap or a
          // live message that beat us): skipped, no duplicate row, no duplicate event.
          if (inserted) published += 1;
        }
      }

      messagesPublished += published;
      channelsProcessed += 1;
      logger.info('backfill channel done', {
        channelId: channelConfig.id,
        published,
        mode: cursor === null ? 'initial' : 'gap',
      });
    } catch (error) {
      // AC-5: one bad channel never aborts the backfill or crashes the bot.
      channelsFailed += 1;
      logger.error('backfill channel failed', {
        channelId: channelConfig.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (signal.aborted) {
    logger.info('backfill aborted by shutdown — completion event not published');
    return;
  }

  // AC-5: always emitted once all channels were attempted, failures included.
  // All-string fields (AD-13); the numeric counts are stringified here.
  const event: Record<keyof BackfillCompletedEvent, string> = {
    type: 'discord.backfill.completed',
    guildId: config.discord.guild_id,
    timestamp: new Date().toISOString(),
    channelsProcessed: String(channelsProcessed),
    channelsFailed: String(channelsFailed),
    messagesPublished: String(messagesPublished),
  };
  await redis.xAdd(STREAM_KEYS.KNOWLEDGE_EVENTS, '*', event);
  logger.info('backfill completed', { channelsProcessed, channelsFailed, messagesPublished });
}
