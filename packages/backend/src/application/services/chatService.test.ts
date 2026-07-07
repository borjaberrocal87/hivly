import { beforeEach, describe, expect, it } from 'vitest';

import type { Citation } from '@hivly/shared/db';
import type { SSEFrame } from '@hivly/shared/schemas';

import type { RagAgent, RunChatInput } from '../../agent/graph.js';
import type {
  Conversation,
  ConversationRepository,
} from '../../domain/repositories/conversationRepository.js';
import { ChatOwnershipError, createChatService } from './chatService.js';

interface AppendedMessage {
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  citations: Citation[];
}

function fakeConversationRepo(seed: Conversation[] = []): ConversationRepository & {
  appended: AppendedMessage[];
  touched: string[];
} {
  const conversations = new Map(seed.map((c) => [c.id, c]));
  const appended: AppendedMessage[] = [];
  const touched: string[] = [];
  let nextId = 0;

  return {
    appended,
    touched,
    async createConversation(userId) {
      nextId += 1;
      const conversation = { id: `new-conv-${nextId}`, userId };
      conversations.set(conversation.id, conversation);
      return conversation;
    },
    async getOwnedConversation(id, userId) {
      const conversation = conversations.get(id);
      return conversation && conversation.userId === userId ? conversation : null;
    },
    async appendMessage(input) {
      appended.push(input);
    },
    async touchConversation(id) {
      touched.push(id);
    },
  };
}

function fakeAgent(frames: SSEFrame[]): RagAgent & { calls: RunChatInput[] } {
  const calls: RunChatInput[] = [];
  return {
    calls,
    async *runChat(input) {
      calls.push(input);
      for (const frame of frames) yield frame;
    },
  };
}

/** Agent that yields `frames`, then throws — simulates an LLM error or an
 * aborted stream (client disconnect) partway through the turn. */
function throwingAgent(frames: SSEFrame[], error = new Error('llm exploded')): RagAgent {
  return {
    async *runChat() {
      for (const frame of frames) yield frame;
      throw error;
    },
  };
}

describe('createChatService().resolveConversation', () => {
  it('should create a new conversation when conversationId is absent', async () => {
    const repo = fakeConversationRepo();
    const service = createChatService({ agent: fakeAgent([]), conversationRepo: repo });

    const conversation = await service.resolveConversation('user-1', undefined);

    expect(conversation.userId).toBe('user-1');
  });

  it('should create a new conversation when conversationId is null', async () => {
    const repo = fakeConversationRepo();
    const service = createChatService({ agent: fakeAgent([]), conversationRepo: repo });

    const conversation = await service.resolveConversation('user-1', null);

    expect(conversation.userId).toBe('user-1');
  });

  it('should return the existing conversation when owned by the caller', async () => {
    const repo = fakeConversationRepo([{ id: 'conv-1', userId: 'user-1' }]);
    const service = createChatService({ agent: fakeAgent([]), conversationRepo: repo });

    const conversation = await service.resolveConversation('user-1', 'conv-1');

    expect(conversation).toEqual({ id: 'conv-1', userId: 'user-1' });
  });

  it('should throw ChatOwnershipError when the conversation is unknown', async () => {
    const repo = fakeConversationRepo();
    const service = createChatService({ agent: fakeAgent([]), conversationRepo: repo });

    await expect(service.resolveConversation('user-1', 'conv-missing')).rejects.toThrow(
      ChatOwnershipError,
    );
  });

  it('should throw ChatOwnershipError when the conversation is owned by someone else', async () => {
    const repo = fakeConversationRepo([{ id: 'conv-1', userId: 'other-user' }]);
    const service = createChatService({ agent: fakeAgent([]), conversationRepo: repo });

    await expect(service.resolveConversation('user-1', 'conv-1')).rejects.toThrow(
      ChatOwnershipError,
    );
  });
});

describe('createChatService().streamChat', () => {
  let repo: ReturnType<typeof fakeConversationRepo>;
  const conversation: Conversation = { id: 'conv-1', userId: 'user-1' };

  beforeEach(() => {
    repo = fakeConversationRepo([conversation]);
  });

  async function collect(frames: AsyncIterable<SSEFrame>): Promise<SSEFrame[]> {
    const out: SSEFrame[] = [];
    for await (const frame of frames) out.push(frame);
    return out;
  }

  it('should forward the agent frames unchanged', async () => {
    const agentFrames: SSEFrame[] = [
      { type: 'token', content: 'Hello' },
      { type: 'citation', channel: 'general', author: 'ada', date: '2026-07-06T00:00:00.000Z' },
      { type: 'done', conversationId: 'conv-1' },
    ];
    const service = createChatService({ agent: fakeAgent(agentFrames), conversationRepo: repo });

    const frames = await collect(service.streamChat(conversation, 'hi', ['chan-1']));

    expect(frames).toEqual(agentFrames);
  });

  it('should persist the user message before yielding any frame', async () => {
    const service = createChatService({
      agent: fakeAgent([{ type: 'done', conversationId: 'conv-1' }]),
      conversationRepo: repo,
    });

    const iterator = service.streamChat(conversation, 'hi there', ['chan-1'])[Symbol.asyncIterator]();
    await iterator.next();

    expect(repo.appended[0]).toEqual({
      conversationId: 'conv-1',
      role: 'user',
      content: 'hi there',
      citations: [],
    });
  });

  it('should accumulate token frames and persist the assistant message with citations', async () => {
    const agentFrames: SSEFrame[] = [
      { type: 'token', content: 'The ' },
      { type: 'token', content: 'answer.' },
      { type: 'citation', channel: 'general', author: 'ada', date: '2026-07-06T00:00:00.000Z' },
      { type: 'done', conversationId: 'conv-1' },
    ];
    const service = createChatService({ agent: fakeAgent(agentFrames), conversationRepo: repo });

    await collect(service.streamChat(conversation, 'hi', ['chan-1']));

    const assistantMessage = repo.appended.find((m) => m.role === 'assistant');
    expect(assistantMessage).toEqual({
      conversationId: 'conv-1',
      role: 'assistant',
      content: 'The answer.',
      citations: [{ channel: 'general', author: 'ada', date: '2026-07-06T00:00:00.000Z' }],
    });
  });

  it('should touch the conversation after the stream completes', async () => {
    const service = createChatService({
      agent: fakeAgent([
        { type: 'token', content: 'ok' },
        { type: 'done', conversationId: 'conv-1' },
      ]),
      conversationRepo: repo,
    });

    await collect(service.streamChat(conversation, 'hi', ['chan-1']));

    expect(repo.touched).toEqual(['conv-1']);
  });

  it('should NOT persist an assistant message or touch when the turn produced nothing', async () => {
    // A `done` with no preceding tokens/citations (or an abort before the first
    // token) must not orphan a blank assistant bubble.
    const service = createChatService({
      agent: fakeAgent([{ type: 'done', conversationId: 'conv-1' }]),
      conversationRepo: repo,
    });

    await collect(service.streamChat(conversation, 'hi', ['chan-1']));

    expect(repo.appended.filter((m) => m.role === 'assistant')).toHaveLength(0);
    expect(repo.touched).toEqual([]);
  });

  it('should still emit done when the best-effort touchConversation fails after a committed answer', async () => {
    // A failed updated_at bump must not fail an already-persisted turn: the
    // assistant row stays saved and the client still receives `done`.
    const repoWithFailingTouch: ConversationRepository = {
      ...fakeConversationRepo([conversation]),
      appendMessage: async () => {},
      touchConversation: async () => {
        throw new Error('transient db error on updated_at');
      },
    };
    const service = createChatService({
      agent: fakeAgent([
        { type: 'token', content: 'hi' },
        { type: 'done', conversationId: 'conv-1' },
      ]),
      conversationRepo: repoWithFailingTouch,
    });

    const frames = await collect(service.streamChat(conversation, 'hi', ['chan-1']));

    expect(frames.at(-1)).toEqual({ type: 'done', conversationId: 'conv-1' });
  });

  it('should pass an empty history and the resolved conversationId to the agent', async () => {
    const agent = fakeAgent([{ type: 'done', conversationId: 'conv-1' }]);
    const service = createChatService({ agent, conversationRepo: repo });

    await collect(service.streamChat(conversation, 'hi', ['chan-1']));

    expect(agent.calls[0]).toEqual({
      message: 'hi',
      history: [],
      allowedChannelIds: ['chan-1'],
      conversationId: 'conv-1',
    });
  });

  it('should persist the assistant message BEFORE emitting the done frame', async () => {
    const agentFrames: SSEFrame[] = [
      { type: 'token', content: 'Hi' },
      { type: 'done', conversationId: 'conv-1' },
    ];
    // Record whether the assistant row exists at the moment `done` is yielded.
    let assistantPersistedWhenDoneSeen = false;
    const service = createChatService({ agent: fakeAgent(agentFrames), conversationRepo: repo });

    for await (const frame of service.streamChat(conversation, 'hi', ['chan-1'])) {
      if (frame.type === 'done') {
        assistantPersistedWhenDoneSeen = repo.appended.some((m) => m.role === 'assistant');
      }
    }

    expect(assistantPersistedWhenDoneSeen).toBe(true);
  });

  it('should persist the partial answer and touch the conversation when the agent throws mid-stream', async () => {
    const service = createChatService({
      agent: throwingAgent([
        { type: 'token', content: 'Par' },
        { type: 'token', content: 'tial' },
      ]),
      conversationRepo: repo,
    });

    // The interruption propagates to the caller (the controller maps it to an
    // error frame) — but persistence must already have happened in `finally`.
    await expect(collect(service.streamChat(conversation, 'hi', ['chan-1']))).rejects.toThrow(
      'llm exploded',
    );

    const assistantMessage = repo.appended.find((m) => m.role === 'assistant');
    expect(assistantMessage).toEqual({
      conversationId: 'conv-1',
      role: 'assistant',
      content: 'Partial',
      citations: [],
    });
    expect(repo.touched).toEqual(['conv-1']);
  });

  it('should persist the assistant turn exactly once (no double-persist on the done path)', async () => {
    const service = createChatService({
      agent: fakeAgent([
        { type: 'token', content: 'x' },
        { type: 'done', conversationId: 'conv-1' },
      ]),
      conversationRepo: repo,
    });

    await collect(service.streamChat(conversation, 'hi', ['chan-1']));

    expect(repo.appended.filter((m) => m.role === 'assistant')).toHaveLength(1);
    expect(repo.touched).toEqual(['conv-1']);
  });
});
