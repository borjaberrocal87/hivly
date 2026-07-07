// Domain port: conversation + message persistence. Pure — no Drizzle. The
// Drizzle implementation lives in infrastructure/ so the application layer
// depends only on this contract (AD-2 spirit). Mirrors embeddingSearchRepository.ts.
import type { Citation } from '@hivly/shared/db';

export interface Conversation {
  id: string;
  userId: string;
}

export interface ConversationRepository {
  /** Create a new conversation owned by `userId`. */
  createConversation(userId: string): Promise<Conversation>;

  /** The conversation `id` if it exists AND is owned by `userId`, else `null`. */
  getOwnedConversation(id: string, userId: string): Promise<Conversation | null>;

  /** Append a message (user or assistant turn) to a conversation. */
  appendMessage(input: {
    conversationId: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    citations: Citation[];
  }): Promise<void>;

  /** Bump `conversations.updated_at` to now. */
  touchConversation(id: string): Promise<void>;
}
