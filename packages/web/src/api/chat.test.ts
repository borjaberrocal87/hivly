// Unit tests for the SSE chat client (Story 5.4). Mocks `fetch` returning a
// ReadableStream of `data: <json>\n\n` chunks (including a frame split across two
// chunks) and asserts: the yielded frame sequence, that a malformed frame is
// skipped (with a warning) while valid frames keep streaming (L-11), the CSRF
// defense-in-depth header on the POST (L-10), and the ChatStreamError throw on a
// non-ok response.
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { SSEFrame } from '@share2brain/shared/schemas';

import { ChatStreamError, streamChat } from './chat';

const encoder = new TextEncoder();

/** A mock `fetch` yielding `chunks` (raw strings) as one streamed response body. */
function streamingFetch(chunks: string[], status = 200): typeof fetch {
  return vi.fn(async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const c of chunks) controller.enqueue(encoder.encode(c));
        controller.close();
      },
    });
    return new Response(stream, {
      status,
      headers: { 'Content-Type': 'text/event-stream' },
    });
  }) as unknown as typeof fetch;
}

function frame(f: SSEFrame): string {
  return `data: ${JSON.stringify(f)}\n\n`;
}

async function collect(body = { message: 'hola' }): Promise<SSEFrame[]> {
  const frames: SSEFrame[] = [];
  for await (const f of streamChat(body)) frames.push(f);
  return frames;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('streamChat', () => {
  it('should yield token, citation, and done frames in wire order', async () => {
    vi.stubGlobal(
      'fetch',
      streamingFetch([
        frame({ type: 'token', content: 'Hola' }),
        frame({ type: 'token', content: ' mundo' }),
        frame({
          type: 'citation',
          title: 'Deploying with Docker Compose',
          channel: 'general',
          author: 'ada',
          date: '2026-06-01T10:00:00Z',
          link: 'https://example.com/doc',
        }),
        frame({ type: 'done', conversationId: '550e8400-e29b-41d4-a716-446655440000' }),
      ]),
    );

    const frames = await collect();

    expect(frames.map((f) => f.type)).toEqual(['token', 'token', 'citation', 'done']);
    expect(frames[0]).toMatchObject({ content: 'Hola' });
    expect(frames[2]).toMatchObject({ channel: 'general', author: 'ada' });
  });

  it('should reassemble a frame split across two chunks', async () => {
    const full = frame({ type: 'token', content: 'partido' });
    const mid = Math.floor(full.length / 2);
    vi.stubGlobal(
      'fetch',
      streamingFetch([full.slice(0, mid), full.slice(mid), frame({ type: 'done', conversationId: '550e8400-e29b-41d4-a716-446655440000' })]),
    );

    const frames = await collect();

    expect(frames.map((f) => f.type)).toEqual(['token', 'done']);
    expect(frames[0]).toMatchObject({ content: 'partido' });
  });

  it('should ignore lines that are not data: frames (e.g. keep-alive comments)', async () => {
    vi.stubGlobal(
      'fetch',
      streamingFetch([
        ': keep-alive\n\n',
        frame({ type: 'token', content: 'ok' }),
        frame({ type: 'done', conversationId: '550e8400-e29b-41d4-a716-446655440000' }),
      ]),
    );

    const frames = await collect();

    expect(frames.map((f) => f.type)).toEqual(['token', 'done']);
  });

  it('should skip a malformed frame (with a warning) and keep streaming valid frames', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal(
      'fetch',
      streamingFetch([
        `data: ${JSON.stringify({ type: 'bogus' })}\n\n`,
        frame({ type: 'token', content: 'ok' }),
        frame({ type: 'done', conversationId: '550e8400-e29b-41d4-a716-446655440000' }),
      ]),
    );

    const frames = await collect();

    // The corrupt frame is dropped; the valid token/done still come through.
    expect(frames.map((f) => f.type)).toEqual(['token', 'done']);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('should send the X-Requested-With CSRF header on the POST', async () => {
    const fetchMock = streamingFetch([
      frame({ type: 'done', conversationId: '550e8400-e29b-41d4-a716-446655440000' }),
    ]);
    vi.stubGlobal('fetch', fetchMock);

    await collect();

    const [, init] = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(init.method).toBe('POST');
    expect(new Headers(init.headers).get('X-Requested-With')).toBe('share2brain');
  });

  it('should throw ChatStreamError carrying the code on a non-ok response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: 'not found', code: 'NOT_FOUND' }), { status: 404 }),
      ),
    );

    await expect(collect()).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 });
    await expect(collect()).rejects.toBeInstanceOf(ChatStreamError);
  });

  it('should default the code to INTERNAL when the error body is not JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('<html>oops</html>', { status: 500 })),
    );

    await expect(collect()).rejects.toMatchObject({ code: 'INTERNAL', status: 500 });
  });
});
