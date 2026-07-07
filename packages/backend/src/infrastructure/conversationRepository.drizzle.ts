// Infrastructure adapter: the ONLY file that knows the conversations/messages
// SQL. Uses the `sql` re-exported by @hivly/shared/db so the backend never
// imports drizzle-orm directly (AD-2). Mirrors readStatusRepository.drizzle.ts.
import { sql, type Citation, type Database } from '@hivly/shared/db';

import type {
  Conversation,
  ConversationRepository,
} from '../domain/repositories/conversationRepository.js';

export function createDrizzleConversationRepository(db: Database): ConversationRepository {
  return {
    async createConversation(userId: string): Promise<Conversation> {
      const result = await db.execute(sql`
        INSERT INTO conversations (user_id)
        VALUES (${userId})
        RETURNING id, user_id AS "userId"
      `);
      const row = result.rows[0] as Record<string, unknown>;
      return { id: String(row.id), userId: String(row.userId) };
    },

    async getOwnedConversation(id: string, userId: string): Promise<Conversation | null> {
      const result = await db.execute(sql`
        SELECT id, user_id AS "userId"
        FROM conversations
        WHERE id = ${id} AND user_id = ${userId}
        LIMIT 1
      `);
      const row = result.rows[0] as Record<string, unknown> | undefined;
      return row ? { id: String(row.id), userId: String(row.userId) } : null;
    },

    async appendMessage(input: {
      conversationId: string;
      role: 'user' | 'assistant' | 'system';
      content: string;
      citations: Citation[];
    }): Promise<void> {
      await db.execute(sql`
        INSERT INTO messages (conversation_id, role, content, citations)
        VALUES (
          ${input.conversationId},
          ${input.role},
          ${input.content},
          ${JSON.stringify(input.citations)}::jsonb
        )
      `);
    },

    async touchConversation(id: string): Promise<void> {
      await db.execute(sql`
        UPDATE conversations SET updated_at = now() WHERE id = ${id}
      `);
    },
  };
}
