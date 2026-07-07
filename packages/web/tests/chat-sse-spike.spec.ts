// SPIKE (Epic 4 retro Action Item #7) — de-risks the VERIFICATION approach for
// Epic 5's streaming chat BEFORE Story 5.1/5.4 build the real UI. Proves the 4.5
// harness can: (1) drive `fetch`-streaming SSE (AD-4 — NOT EventSource, so the
// client can POST a body) against a backend through the vite-preview proxy;
// (2) observe `token` frames accumulate INCREMENTALLY (not one buffered flush);
// (3) parse each frame against the shared `SSEFrameSchema` contract.
//
// Endpoint under test: `/api/_spike/chat-sse` (mounted only in the e2e backend,
// see packages/backend/src/e2e/server.ts). Delete this spec + that route when
// Story 5.1 lands the real `/api/chat`; 5.4's spec reuses this exact pattern.
import { expect, test } from '@playwright/test';

import { SSEFrameSchema } from '@hivly/shared/schemas';

import { loginAs } from './helpers/session';

const EXPECTED_TEXT = 'Hola desde el agente Hivly.';
// 6 tokens × 50ms ≈ 250ms of spread. A buffering proxy would deliver every frame
// in a single read → near-zero spread; this threshold detects that regression.
const MIN_STREAM_SPREAD_MS = 120;

type SpikeResult = {
  error: string | null;
  done: boolean;
  frames: unknown[];
  timestamps: number[];
  bubbleText: string;
};

test.describe('SPIKE — SSE fetch-streaming through the harness (Epic 4 retro AI#7)', () => {
  test('token frames accumulate incrementally and validate against SSEFrameSchema', async ({
    page,
  }, testInfo) => {
    await loginAs(page, 'e2e-member');

    // Kick off the stream in the page WITHOUT awaiting completion: a detached
    // async reader appends each token to #spike-bubble as it arrives and records
    // a per-frame timestamp, so Node can both watch the DOM grow live and later
    // assert the arrival spread. This mirrors Story 5.4's incremental-render path.
    await page.evaluate(() => {
      type SpikeState = {
        error: string | null;
        done: boolean;
        frames: { type: string; content?: string; conversationId?: string }[];
        timestamps: number[];
        bubbleText: string;
      };

      const bubble = document.createElement('div');
      bubble.id = 'spike-bubble';
      bubble.style.font = '16px monospace';
      bubble.style.padding = '24px';
      document.body.prepend(bubble);

      const state: SpikeState = {
        error: null,
        done: false,
        frames: [],
        timestamps: [],
        bubbleText: '',
      };
      (window as unknown as { __spike: SpikeState }).__spike = state;

      void (async (): Promise<void> => {
        try {
          const res = await fetch('/api/_spike/chat-sse', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: '{}',
          });
          if (!res.ok || res.body === null) {
            state.error = `bad response: ${res.status}`;
            return;
          }
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            let sep: number;
            while ((sep = buffer.indexOf('\n\n')) !== -1) {
              const event = buffer.slice(0, sep);
              buffer = buffer.slice(sep + 2);
              const dataLine = event.split('\n').find((l) => l.startsWith('data:'));
              if (dataLine === undefined) continue;
              const frame = JSON.parse(dataLine.slice('data:'.length).trim()) as {
                type: string;
                content?: string;
              };
              state.frames.push(frame);
              state.timestamps.push(performance.now());
              if (frame.type === 'token' && typeof frame.content === 'string') {
                bubble.textContent = (bubble.textContent ?? '') + frame.content;
              }
            }
          }
          state.bubbleText = bubble.textContent ?? '';
          state.done = true;
        } catch (err) {
          state.error = err instanceof Error ? err.message : String(err);
        }
      })();
    });

    // The harness can OBSERVE the bubble grow live — the first token lands well
    // before the stream finishes. This is the assertion Story 5.4 will make.
    await expect(page.locator('#spike-bubble')).toContainText('Hola', { timeout: 3_000 });

    // Wait for the stream to close, then pull the collected frames + timings.
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { __spike: SpikeResult }).__spike.done), {
        timeout: 5_000,
      })
      .toBe(true);
    const spike = await page.evaluate(
      () => (window as unknown as { __spike: SpikeResult }).__spike,
    );

    // No stream error.
    expect(spike.error).toBeNull();

    // Every frame validates against the REAL shared wire contract.
    for (const frame of spike.frames) {
      expect(SSEFrameSchema.safeParse(frame).success).toBe(true);
    }

    // Frame shape: N token frames, a citation, a terminal done.
    const tokenFrames = spike.frames.filter(
      (f): f is { type: 'token'; content: string } =>
        (f as { type: string }).type === 'token',
    );
    expect(tokenFrames.length).toBe(6);
    expect(spike.frames.some((f) => (f as { type: string }).type === 'citation')).toBe(true);
    const last = spike.frames.at(-1) as { type: string; conversationId?: string };
    expect(last.type).toBe('done');
    expect(last.conversationId).toBe('e2e-spike-conv');

    // Full reassembled text landed in the DOM.
    expect(spike.bubbleText).toBe(EXPECTED_TEXT);
    await expect(page.locator('#spike-bubble')).toHaveText(EXPECTED_TEXT);

    // INCREMENTAL, not buffered: the frames arrived spread over time. A buffering
    // proxy would collapse the spread toward zero.
    const spread = Math.max(...spike.timestamps) - Math.min(...spike.timestamps);
    expect(spread).toBeGreaterThanOrEqual(MIN_STREAM_SPREAD_MS);

    await page.screenshot({ path: testInfo.outputPath('sse-spike.png'), fullPage: true });
  });
});
