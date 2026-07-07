import { describe, expect, it } from 'vitest';

import type { SearchFragment, SSEFrame } from '@hivly/shared/schemas';

import type { ChatModel, ChatTurn } from '../domain/repositories/chatModel.js';
import type { RagRetriever } from '../domain/repositories/ragRetriever.js';
import { createRagAgent } from './graph.js';

function fakeChatModel(chunks: string[]): ChatModel {
  return {
    async *stream(): AsyncIterable<string> {
      for (const chunk of chunks) yield chunk;
    },
  };
}

/** Records the prepared messages the `reason` node hands to the model, so tests
 * can assert history-truncation behavior (the `memory_window` guard). */
function recordingChatModel(): ChatModel & { received: ChatTurn[][] } {
  const received: ChatTurn[][] = [];
  return {
    received,
    async *stream(messages: ChatTurn[]): AsyncIterable<string> {
      received.push(messages);
      yield 'ok';
    },
  };
}

function fakeFragment(overrides: Partial<SearchFragment> = {}): SearchFragment {
  return {
    id: '550e8400-e29b-41d4-a716-446655440000',
    content: 'the answer is 42',
    channelId: 'chan-1',
    channelName: 'general',
    authorId: 'author-1',
    authorName: 'ada',
    createdAt: '2026-07-06T00:00:00.000Z',
    similarity: 0.9,
    messageId: 'msg-1',
    ...overrides,
  };
}

function fakeRagRetriever(fragments: SearchFragment[]): RagRetriever {
  return {
    async retrieve(_query, allowedChannelIds) {
      return allowedChannelIds.length === 0 ? [] : fragments;
    },
  };
}

async function collect(frames: AsyncIterable<SSEFrame>): Promise<SSEFrame[]> {
  const out: SSEFrame[] = [];
  for await (const frame of frames) out.push(frame);
  return out;
}

describe('createRagAgent().runChat', () => {
  it('should yield token frames, then citation frames, then a terminal done frame', async () => {
    const agent = createRagAgent({
      chatModel: fakeChatModel(['Hello', ' world']),
      ragRetriever: fakeRagRetriever([fakeFragment()]),
      memoryWindow: 20,
    });

    const frames = await collect(
      agent.runChat({
        message: 'what is the answer?',
        history: [],
        allowedChannelIds: ['chan-1'],
        conversationId: 'conv-1',
      }),
    );

    expect(frames).toEqual([
      { type: 'token', content: 'Hello' },
      { type: 'token', content: ' world' },
      { type: 'citation', channel: 'general', author: 'ada', date: '2026-07-06T00:00:00.000Z' },
      { type: 'done', conversationId: 'conv-1' },
    ]);
  });

  it('should emit no citation frames when the RBAC scope is empty', async () => {
    const agent = createRagAgent({
      chatModel: fakeChatModel(['ok']),
      ragRetriever: fakeRagRetriever([fakeFragment()]),
      memoryWindow: 20,
    });

    const frames = await collect(
      agent.runChat({
        message: 'anything?',
        history: [],
        allowedChannelIds: [],
        conversationId: 'conv-2',
      }),
    );

    expect(frames.filter((f) => f.type === 'citation')).toHaveLength(0);
    expect(frames.at(-1)).toEqual({ type: 'done', conversationId: 'conv-2' });
  });

  it('should map fragment fields to the citation frame correctly', async () => {
    const agent = createRagAgent({
      chatModel: fakeChatModel(['x']),
      ragRetriever: fakeRagRetriever([
        fakeFragment({ channelName: 'random', authorName: 'grace', createdAt: '2026-01-01T00:00:00.000Z' }),
      ]),
      memoryWindow: 20,
    });

    const frames = await collect(
      agent.runChat({
        message: 'q',
        history: [],
        allowedChannelIds: ['chan-1'],
        conversationId: 'conv-3',
      }),
    );

    expect(frames).toContainEqual({
      type: 'citation',
      channel: 'random',
      author: 'grace',
      date: '2026-01-01T00:00:00.000Z',
    });
  });

  it('should carry the conversationId from the input in the done frame', async () => {
    const agent = createRagAgent({
      chatModel: fakeChatModel([]),
      ragRetriever: fakeRagRetriever([]),
      memoryWindow: 20,
    });

    const frames = await collect(
      agent.runChat({
        message: 'q',
        history: [],
        allowedChannelIds: ['chan-1'],
        conversationId: 'conv-4',
      }),
    );

    expect(frames.at(-1)).toEqual({ type: 'done', conversationId: 'conv-4' });
  });

  it('should include the current turn in the prompt when memoryWindow >= 1', async () => {
    const model = recordingChatModel();
    const agent = createRagAgent({
      chatModel: model,
      ragRetriever: fakeRagRetriever([]),
      memoryWindow: 1,
    });

    await collect(
      agent.runChat({
        message: 'the question',
        history: [],
        allowedChannelIds: ['chan-1'],
        conversationId: 'conv-5',
      }),
    );

    const prepared = model.received[0];
    expect(prepared.some((t) => t.role === 'user' && t.content === 'the question')).toBe(true);
  });

  it('should truncate history to [] when memoryWindow <= 0 (guards slice(-0) === full history)', async () => {
    const model = recordingChatModel();
    const agent = createRagAgent({
      chatModel: model,
      ragRetriever: fakeRagRetriever([]),
      memoryWindow: 0,
    });

    await collect(
      agent.runChat({
        message: 'the question',
        history: [],
        allowedChannelIds: ['chan-1'],
        conversationId: 'conv-6',
      }),
    );

    // With the guard, memoryWindow 0 keeps zero turns — only the system + RAG
    // context messages remain (no user turn). Without the guard, slice(-0)
    // would have returned the FULL history instead.
    const prepared = model.received[0];
    expect(prepared.every((t) => t.role === 'system')).toBe(true);
  });
});
