// Shared shape for the Sync pipeline's two processors, so `consumer.ts` can
// dispatch to either without depending on one processor module from the other.
export interface ProcessResult {
  /** Whether the consumer should XACK this entry. `false` leaves it PENDING
   *  for redelivery (AD-13) — only set on a caught exception. */
  ack: boolean;
}
