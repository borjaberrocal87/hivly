// Deterministic E2E backend for the Playwright harness (Story 4.5). Spawned as a
// process by Playwright's webServer[0] — `packages/web` never imports this
// (AD-2); it drives the built SPA against it over HTTP. Reuses the same
// injection points the integration suites use (`openTestClients`,
// `buildTestAppOptions`, `fakeQueryEmbedder`), so there is NO production code
// path here and NO auth-bypass route — just createApp wired with a fake OAuth
// client + a deterministic query embedder over the reset-then-seeded test DB.
//
// Refuses to start under NODE_ENV=production before `main()` ever opens a DB/Redis
// connection or listens on a port — no production route or listener is reachable,
// even though the `import`s below (all side-effect-free at module load) still
// evaluate first, per normal ES module hoisting. Run: `npm run e2e:server -w @hivly/backend`.
if (process.env.NODE_ENV === 'production') {
  console.error('[e2e] refusing to start in production');
  process.exit(1);
}

import type { Request, Response } from 'express';

import type { SSEFrame } from '@hivly/shared/schemas';

import { createApp } from '../app.js';
import type { DiscordOAuthClient } from '../domain/repositories/discordOAuthClient.js';
import { buildTestAppOptions, fakeQueryEmbedder, openTestClients } from '../test-helpers.js';
import { resetAndSeed } from './seed.js';

/**
 * SPIKE (Epic 4 retro Action Item #7) — NOT production, NOT Story 5.1's real
 * `/api/chat`. A throwaway SSE endpoint that streams `token` frames spaced over
 * time, then a `citation` and a `done`, all conforming to the shared
 * `SSEFrameSchema` wire format. It lets the Playwright harness prove it can drive
 * `fetch`-streaming (AD-4, NOT EventSource) and observe frames accumulate
 * INCREMENTALLY through the vite-preview proxy — the exact mechanism Story 5.4's
 * chat UI will use. If the proxy buffered the whole response, the frames would
 * all land in one read and the spec's timing-spread assertion would fail.
 *
 * Mounted here only (never in `createApp`) → no production route, AD-2 intact.
 * Delete this and its spec when Story 5.1 lands the real `/api/chat`.
 */
const SPIKE_TOKENS = ['Hola', ' desde', ' el', ' agente', ' Hivly', '.'];
const SPIKE_TOKEN_INTERVAL_MS = 50;

function mountSpikeChatSse(app: ReturnType<typeof createApp>): void {
  app.post('/api/_spike/chat-sse', (req: Request, res: Response): void => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const frames: SSEFrame[] = [
      ...SPIKE_TOKENS.map((content): SSEFrame => ({ type: 'token', content })),
      { type: 'citation', channel: '#general', author: 'e2e-author-ada', date: '2026-07-07' },
      { type: 'done', conversationId: 'e2e-spike-conv' },
    ];

    let i = 0;
    let timer: NodeJS.Timeout;
    const send = (): void => {
      if (i >= frames.length) {
        res.end();
        return;
      }
      res.write(`data: ${JSON.stringify(frames[i])}\n\n`);
      i += 1;
      timer = setTimeout(send, SPIKE_TOKEN_INTERVAL_MS);
    };
    req.on('close', () => clearTimeout(timer));
    send();
  });
}

// Ports/origins: keep the dev backend (3000) + dev Vite (5173) free so the
// harness coexists with a running dev stack. Vite preview serves on 4173.
const E2E_BACKEND_PORT = Number(process.env.E2E_BACKEND_PORT || 3100);
const E2E_WEB_ORIGIN = process.env.E2E_WEB_ORIGIN ?? 'http://localhost:4173';

/**
 * Fake OAuth that maps the `code` to an identity (D3): `e2e-empty` logs in a user
 * whose only channel (`e2e-ch-void`) has no embeddings — the ONLY way to reach the
 * search empty state, since search has no similarity threshold. Every other code
 * logs in the seeded member. Same 3-method port as the integration tests.
 */
function e2eOAuth(): DiscordOAuthClient {
  return {
    exchangeCode: async (code) => ({ accessToken: code }),
    getCurrentUser: async (token) =>
      token === 'e2e-empty'
        ? { id: 'e2e-user-empty', username: 'e2e-empty', avatar: null }
        : { id: 'e2e-user-member', username: 'e2e-member', avatar: null },
    getGuildMember: async (token) => ({
      roles: token === 'e2e-empty' ? ['e2e-role-empty'] : ['e2e-role-member'],
    }),
  };
}

async function main(): Promise<void> {
  const clients = await openTestClients();

  const summary = await resetAndSeed(clients.db);
  console.log(
    `[e2e] seeded: ${summary.channels} channels, ${summary.messages} messages, ` +
      `${summary.embeddings} embeddings, ${summary.read} read`,
  );

  const app = createApp(
    clients.db,
    clients.redis,
    buildTestAppOptions({
      oauth: e2eOAuth(),
      queryEmbedder: fakeQueryEmbedder(),
      frontendUrl: E2E_WEB_ORIGIN,
      allowedOrigins: [E2E_WEB_ORIGIN],
    }),
  );

  mountSpikeChatSse(app);

  const server = app.listen(E2E_BACKEND_PORT, '127.0.0.1', () => {
    console.log(`[e2e] backend listening on http://127.0.0.1:${E2E_BACKEND_PORT}`);
  });
  server.on('error', (err: Error) => {
    console.error('[e2e] listen failed:', err.message);
    process.exit(1);
  });

  // Playwright's webServer sends SIGTERM on teardown. Close the HTTP server and
  // the clients so the process exits cleanly. Do NOT delete seed rows — the
  // boot-time reset makes runs idempotent and keeps post-run state inspectable.
  // `server.close()` only waits for in-flight requests — idle keep-alive sockets
  // can hold it open past Playwright's own teardown timeout, so force-exit as a
  // fallback if a clean close doesn't happen quickly.
  let shuttingDown = false;
  const shutdown = (signal: string): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[e2e] ${signal} received, shutting down`);
    const forceExit = setTimeout(() => process.exit(1), 5_000);
    forceExit.unref();
    server.close((err) => {
      if (err) console.error('[e2e] close error:', err.message);
      clients
        .close()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
    });
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err: unknown) => {
  console.error('[e2e] failed to start:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
