// Unit tests for the M-2 audit fix: asyncHandler forwards controller rejections to
// Express's error pipeline, and createErrorHandler is the terminal net that maps
// them (and sync middleware throws) to a unified { error, code } 500. Pure unit —
// a minimal Express app with no DB/Redis, exercised via supertest.
import type { Logger } from '@share2brain/shared/logger';
import express, { type Request, type Response } from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { asyncHandler } from './asyncHandler.js';
import { createErrorHandler } from './errorHandler.js';

/** A Logger whose `error` sink is a spy, returned alongside for assertions. */
function fakeLogger(): { logger: Logger; error: ReturnType<typeof vi.fn> } {
  const error = vi.fn();
  const logger: Logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error };
  return { logger, error };
}

describe('asyncHandler — [rejection forwarding]', () => {
  afterEach(() => vi.restoreAllMocks());

  it('should route a rejected async controller to the error middleware as a 500 with the unified shape', async () => {
    // Arrange
    const { logger, error } = fakeLogger();
    const app = express();
    app.get(
      '/boom',
      asyncHandler(async () => {
        throw new Error('leaky db detail');
      }),
    );
    app.use(createErrorHandler(logger));

    // Act
    const res = await request(app).get('/boom');

    // Assert — generic body, never the raw error message; logged via the injected logger.
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Internal error', code: 'INTERNAL' });
    expect(res.body.error).not.toContain('leaky db detail');
    expect(error).toHaveBeenCalledWith('unhandled request error', { reason: 'leaky db detail' });
  });

  it('should NOT invoke the error middleware when the async controller resolves normally', async () => {
    // Arrange
    const { logger, error } = fakeLogger();
    const app = express();
    app.get(
      '/ok',
      asyncHandler(async (_req: Request, res: Response) => {
        res.status(200).json({ ok: true });
      }),
    );
    app.use(createErrorHandler(logger));

    // Act
    const res = await request(app).get('/ok');

    // Assert
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(error).not.toHaveBeenCalled();
  });
});

describe('createErrorHandler — [terminal error middleware]', () => {
  afterEach(() => vi.restoreAllMocks());

  it('should map a malformed-JSON SyntaxError from express.json() to a 500 with the unified shape', async () => {
    // Arrange — a sync throw in middleware (not via asyncHandler) still hits the net.
    const { logger, error } = fakeLogger();
    const app = express();
    app.use(express.json());
    app.post('/echo', (req: Request, res: Response) => res.json(req.body));
    app.use(createErrorHandler(logger));

    // Act
    const res = await request(app)
      .post('/echo')
      .set('Content-Type', 'application/json')
      .send('{ not valid json');

    // Assert
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Internal error', code: 'INTERNAL' });
    expect(error).toHaveBeenCalledOnce();
  });

  it('should fall back to console.error when no logger is injected', async () => {
    // Arrange
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const app = express();
    app.get(
      '/boom',
      asyncHandler(async () => {
        throw new Error('kaboom');
      }),
    );
    app.use(createErrorHandler());

    // Act
    const res = await request(app).get('/boom');

    // Assert
    expect(res.status).toBe(500);
    expect(consoleError).toHaveBeenCalledWith('[app] unhandled request error:', 'kaboom');
  });

  it('should NOT re-send a response whose headers were already sent, delegating to Express instead (SSE guard)', () => {
    // A response mid-SSE-stream has headersSent = true (POST /api/chat). The guard
    // must delegate to next(err) and must NEVER call res.status/res.json — doing so
    // would throw "Cannot set headers after they are sent". Exercised directly with
    // mocks (an end-to-end socket teardown is flaky and orthogonal to this contract).
    const { logger, error } = fakeLogger();
    const handler = createErrorHandler(logger);

    const status = vi.fn();
    const json = vi.fn();
    const next = vi.fn();
    const res = { headersSent: true, status, json } as unknown as Response;
    const err = new Error('mid-stream failure');

    handler(err, {} as Request, res, next);

    expect(next).toHaveBeenCalledWith(err);
    expect(status).not.toHaveBeenCalled();
    expect(json).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledOnce();
  });
});
