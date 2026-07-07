import { describe, expect, it } from 'vitest';

import type { ChatModel, ChatTurn } from '../domain/repositories/chatModel.js';
import { COMPRESSION_TOKEN_BUDGET, compressIfNeeded, estimateTokens } from './compress.js';

/** A chat model that records how many times it was streamed and yields a fixed
 * summary. Lets tests assert whether summarization ran. */
function recordingChatModel(summary = 'SUMMARY'): ChatModel & { calls: ChatTurn[][] } {
  const calls: ChatTurn[][] = [];
  return {
    calls,
    async *stream(messages: ChatTurn[]): AsyncIterable<string> {
      calls.push(messages);
      yield summary;
    },
  };
}

/** A turn whose content is `chars` characters long (≈ chars/4 estimated tokens). */
function turn(role: ChatTurn['role'], chars: number, marker = 'x'): ChatTurn {
  return { role, content: marker.repeat(chars) };
}

describe('estimateTokens', () => {
  it('should estimate ~1 token per 4 characters', () => {
    expect(estimateTokens('12345678')).toBe(2);
  });

  it('should be monotonic — never fewer tokens for longer text', () => {
    expect(estimateTokens('a'.repeat(40))).toBeGreaterThanOrEqual(estimateTokens('a'.repeat(20)));
  });

  it('should round up partial tokens', () => {
    expect(estimateTokens('abc')).toBe(1);
    expect(estimateTokens('')).toBe(0);
  });
});

describe('compressIfNeeded', () => {
  it('should return the SAME array unchanged and NOT call the model when under budget', async () => {
    const model = recordingChatModel();
    const messages: ChatTurn[] = [turn('user', 40), turn('assistant', 40)];

    const result = await compressIfNeeded(messages, model, COMPRESSION_TOKEN_BUDGET);

    expect(result).toBe(messages); // identity — pass-through, no allocation
    expect(model.calls).toHaveLength(0); // no summarization
  });

  it('should summarize the oldest turns and keep the recent tail when over budget', async () => {
    const model = recordingChatModel('the compressed summary');
    // Each turn ≈ 1000 tokens (4000 chars); 6 turns ≈ 6000 tokens > 4000 budget.
    const messages: ChatTurn[] = [
      turn('user', 4000, 'a'),
      turn('assistant', 4000, 'b'),
      turn('user', 4000, 'c'),
      turn('assistant', 4000, 'd'),
      turn('user', 4000, 'e'),
      turn('assistant', 4000, 'f'),
    ];

    const result = await compressIfNeeded(messages, model, COMPRESSION_TOKEN_BUDGET);

    // First message is the ephemeral system summary.
    expect(result[0].role).toBe('system');
    expect(result[0].content).toContain('the compressed summary');
    expect(result[0].content.startsWith('<conversation summary>')).toBe(true);
    // The most-recent turns are preserved verbatim as the tail.
    expect(result.at(-1)).toEqual(messages.at(-1));
    // Compression actually shrank the set (summary + tail < original count).
    expect(result.length).toBeLessThan(messages.length);
    // The model was streamed exactly once (for the summary).
    expect(model.calls).toHaveLength(1);
  });

  it('should keep the most-recent turn verbatim (never summarize the latest turn)', async () => {
    const model = recordingChatModel();
    const latest = turn('user', 4000, 'z');
    // 5 turns ≈ 5000 tokens > the 4000 budget, so this genuinely exercises the
    // summarization branch (unlike a smaller set, which would just pass through).
    const messages: ChatTurn[] = [
      turn('user', 4000, 'a'),
      turn('assistant', 4000, 'b'),
      turn('user', 4000, 'c'),
      turn('assistant', 4000, 'd'),
      latest,
    ];

    const result = await compressIfNeeded(messages, model, COMPRESSION_TOKEN_BUDGET);

    expect(model.calls).toHaveLength(1); // compression actually ran
    expect(result).toContainEqual(latest);
    expect(result.some((m) => m.role === 'system')).toBe(true); // an older turn WAS summarized
  });

  it('should pass through a single oversized turn (nothing older to summarize)', async () => {
    const model = recordingChatModel();
    const messages: ChatTurn[] = [turn('user', 40000, 'a')]; // ≈10000 tokens, alone

    const result = await compressIfNeeded(messages, model, COMPRESSION_TOKEN_BUDGET);

    expect(result).toBe(messages);
    expect(model.calls).toHaveLength(0);
  });
});
