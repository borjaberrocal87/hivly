// Pure offline-reconciliation diff (AC-3, AC-4, AC-7). No I/O, no logging —
// the orchestrator (offlineSync.ts) owns fetching, persisting, and publishing.
//
// Edit detection is a content diff (note #4, DECISION 2): definitive and robust
// to clock skew, unlike comparing editedAt to updated_at.
//
// Delete detection is conservative (note #5, DECISION 3): a persisted row is
// concluded deleted-offline only when it is absent from the fetched set AND its
// id falls within the fully-covered fetched window (id >= oldestFetchedId). A
// row below that window was simply never looked at this run — never conclude a
// delete for it, since under delete_policy=hard a false positive permanently
// purges a vector.
import type { UpdatableMessage } from '../discord/handlers/messageUpdate.js';

export interface PersistedRow {
  id: string; // Discord snowflake
  content: string;
}

/** The narrow current-Discord slice this module reads — assignable to UpdatableMessage
 * so the orchestrator can hand a diffed edit straight to handleMessageUpdate. */
export type FetchedMessage = UpdatableMessage;

export interface DiffChannelInput {
  persisted: PersistedRow[]; // non-deleted rows only — caller pre-filters deleted_at IS NULL
  fetched: FetchedMessage[];
  lastSeen: string;
}

export interface DiffChannelResult {
  edits: FetchedMessage[];
  deletes: PersistedRow[];
  reconciled: number;
}

/**
 * Parse a Discord snowflake as a BigInt for numeric comparison. Snowflakes are
 * variable-length TEXT (18 digits pre-2022, 19 after) — lexicographic compare
 * mis-orders them. BigInt('') / BigInt('  ') return 0n instead of throwing, so
 * an all-digit guard is required before parsing (mirrors backfill/pages.ts).
 */
export function toIdKey(id: string): bigint | null {
  return /^\d+$/.test(id) ? BigInt(id) : null;
}

/**
 * Diff a channel's persisted rows against its freshly re-fetched Discord state.
 * Pure and synchronous — no I/O.
 */
export function diffChannel({ persisted, fetched, lastSeen }: DiffChannelInput): DiffChannelResult {
  const fetchedById = new Map(fetched.map((m) => [m.id, m]));

  const fetchedKeys = fetched
    .map((m) => toIdKey(m.id))
    .filter((key): key is bigint => key !== null);
  const oldestFetchedId =
    fetchedKeys.length > 0 ? fetchedKeys.reduce((min, key) => (key < min ? key : min)) : null;
  const lastSeenKey = toIdKey(lastSeen);

  const edits: FetchedMessage[] = [];
  const deletes: PersistedRow[] = [];

  for (const row of persisted) {
    const fetchedMessage = fetchedById.get(row.id);
    if (fetchedMessage) {
      if (fetchedMessage.content !== row.content) {
        edits.push(fetchedMessage);
      }
      continue;
    }

    // Absent from the fetched set — a delete candidate ONLY inside the fully
    // covered window. An empty/all-non-numeric fetch means no covered window
    // at all: conclude nothing (note #5).
    if (oldestFetchedId === null) continue;
    // A non-parseable anchor means we cannot exclude the exclusive-boundary
    // anchor row from the delete window — stay fail-SAFE (delete-conservatism,
    // note #5) and conclude no deletes rather than risk a false hard-purge.
    if (lastSeenKey === null) continue;
    const rowKey = toIdKey(row.id);
    if (rowKey === null) continue; // cannot compare safely — never guess a delete
    if (rowKey < oldestFetchedId) continue; // below the covered window
    // The anchor (lastSeen) itself — and anything at/above it — was NEVER
    // fetched: the offline-sync walk seeds `before: lastSeen`, which is
    // EXCLUSIVE of the anchor id. An absent anchor row is therefore not
    // evidence of a delete, just an artifact of the exclusive boundary.
    if (rowKey >= lastSeenKey) continue;
    deletes.push(row);
  }

  return { edits, deletes, reconciled: persisted.length };
}
