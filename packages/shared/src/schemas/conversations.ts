// Conversations API contract (AD-6). Request/response shapes for
// GET /api/conversations (paginated list) and GET /api/conversations/:conversationId
// (detail with messages), plus the stable error codes the endpoints emit. Mirrors
// documents.ts. The list `title` is DERIVED from each conversation's first user
// message (Story 5.2 D1 — there is NO `title` column); the service truncates it to
// CONVERSATION_TITLE_MAX_LENGTH.
import { z } from 'zod';

import { CitationSchema } from './citation.js';

/** Max length of a derived conversation title (D10). Kept here so the service and
 * any future consumer share one constant instead of duplicating the number. */
export const CONVERSATION_TITLE_MAX_LENGTH = 80;

/**
 * GET /api/conversations query params. Query params arrive as strings, so
 * `page`/`limit` are coerced. `page` defaults to 1 (min 1); `limit` defaults to 20
 * (min 1, max 100). `page` is capped (max 1_000_000) so a huge value can't overflow
 * the Postgres OFFSET (`(page-1)*limit`) into a 500 — an out-of-range page yields a
 * clean 400 instead. Copied verbatim from documents.ts (same rationale).
 */
export const ConversationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(1_000_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type ConversationsQuery = z.infer<typeof ConversationsQuerySchema>;

/** A single conversation in the list: id + derived title + timestamps (ISO 8601). */
export const ConversationSummarySchema = z.object({
  id: z.uuid(),
  title: z.string(),
  createdAt: z.string(), // ISO 8601
  updatedAt: z.string(), // ISO 8601
});

export type ConversationSummary = z.infer<typeof ConversationSummarySchema>;

/** GET /api/conversations — a paginated page of conversation summaries. */
export const ConversationsResponseSchema = z.object({
  results: z.array(ConversationSummarySchema),
  page: z.number().int(),
  limit: z.number().int(),
  total: z.number().int(),
});

export type ConversationsResponse = z.infer<typeof ConversationsResponseSchema>;

/** A single message inside a conversation detail. `citations` reuses the shared
 * CitationSchema (D11) — the same shape stored in `messages.citations`. */
export const ConversationMessageSchema = z.object({
  id: z.uuid(),
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
  citations: z.array(CitationSchema),
  createdAt: z.string(), // ISO 8601
});

export type ConversationMessage = z.infer<typeof ConversationMessageSchema>;

/** GET /api/conversations/:conversationId — the conversation plus its messages,
 * ordered chronologically (`created_at ASC`). */
export const ConversationDetailSchema = z.object({
  id: z.uuid(),
  createdAt: z.string(), // ISO 8601
  updatedAt: z.string(), // ISO 8601
  messages: z.array(ConversationMessageSchema),
});

export type ConversationDetail = z.infer<typeof ConversationDetailSchema>;

/** Stable error `code`s emitted by the conversations endpoints (paired with
 * ErrorSchema). Mirrors READ_STATUS_ERROR (D9 uses NOT_FOUND for both a
 * non-owned/unknown id and a malformed id — no existence leak). */
export const CONVERSATIONS_ERROR = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  INTERNAL: 'INTERNAL',
} as const;

export type ConversationsErrorCode = (typeof CONVERSATIONS_ERROR)[keyof typeof CONVERSATIONS_ERROR];
