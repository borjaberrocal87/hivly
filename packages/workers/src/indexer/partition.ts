// Dedup-state classification for one batch's parsed entries (relocated from
// `grouping.ts` — Story 7.2 demolished the grouping/chunking half of that file;
// this pure stage survives unchanged). Deterministic: re-processing the SAME
// PEL entries on a crash-restart classifies them identically (AD-13).
import type { IndexStateRow, ParsedEntry, PartitionResult } from './types.js';

/**
 * Classify a batch's parsed entries against their `discord_messages` dedup rows.
 *
 * - row present with `indexed_at` set  → `ackNow`  (already indexed; XACK + skip)
 * - no row for the message id          → `pending` (XADD raced ahead of COMMIT;
 *                                          leave un-ACKed, reconciliation note 5)
 * - row present, `indexed_at` NULL     → `toProcess`
 *
 * A message id may appear more than once in a batch (producer duplicate); each
 * entry is classified independently so duplicates land in the same bucket.
 */
export function partitionByIndexState(
  entries: ParsedEntry[],
  rows: IndexStateRow[],
): PartitionResult {
  const indexState = new Map<string, IndexStateRow['indexedAt']>();
  for (const row of rows) indexState.set(row.id, row.indexedAt);

  const ackNow: string[] = [];
  const pending: string[] = [];
  const toProcess: ParsedEntry[] = [];

  for (const entry of entries) {
    const id = entry.event.messageId;
    if (!indexState.has(id)) {
      pending.push(entry.streamId);
    } else if (indexState.get(id) != null) {
      ackNow.push(entry.streamId);
    } else {
      toProcess.push(entry);
    }
  }

  return { ackNow, pending, toProcess };
}
