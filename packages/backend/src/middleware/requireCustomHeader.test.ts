// Unit tests for the L-2 CSRF defense-in-depth middleware: a non-GET request under
// /api WITHOUT X-Requested-With is 403'd; WITH it (any non-empty value) it passes
// through; safe methods (GET/HEAD/OPTIONS) are always exempt. Exercised both as a
// bare handler (req/res doubles) and end-to-end via a minimal Express app mounted
// like app.ts (`app.use('/api', requireCustomHeader)`).
import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';

import { requireCustomHeader } from './requireCustomHeader.js';

/** Minimal res double capturing the status/json a 403 would emit. */
function fakeRes(): Response & { statusCode?: number; body?: unknown } {
  const res = {} as Response & { statusCode?: number; body?: unknown };
  res.status = vi.fn((code: number) => {
    res.statusCode = code;
    return res;
  }) as unknown as Response['status'];
  res.json = vi.fn((payload: unknown) => {
    res.body = payload;
    return res;
  }) as unknown as Response['json'];
  return res;
}

/** Build a req double with a given method and optional X-Requested-With header. */
function fakeReq(method: string, header?: string): Request {
  return {
    method,
    get: (name: string) => (name === 'X-Requested-With' ? header : undefined),
  } as unknown as Request;
}

describe('requireCustomHeader — [bare handler]', () => {
  it('should respond 403 FORBIDDEN when a POST omits X-Requested-With', () => {
    const res = fakeRes();
    const next = vi.fn() as unknown as NextFunction;

    requireCustomHeader(fakeReq('POST'), res, next);

    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ error: 'Forbidden', code: 'FORBIDDEN' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should respond 403 FORBIDDEN when the header is present but empty/whitespace', () => {
    const res = fakeRes();
    const next = vi.fn() as unknown as NextFunction;

    requireCustomHeader(fakeReq('DELETE', '   '), res, next);

    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('should call next() when a POST carries a non-empty X-Requested-With', () => {
    const res = fakeRes();
    const next = vi.fn() as unknown as NextFunction;

    requireCustomHeader(fakeReq('POST', 'share2brain'), res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it.each(['GET', 'HEAD', 'OPTIONS'])('should exempt the safe method %s even without the header', (method) => {
    const res = fakeRes();
    const next = vi.fn() as unknown as NextFunction;

    requireCustomHeader(fakeReq(method), res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe('requireCustomHeader — [mounted on /api like app.ts]', () => {
  function buildApp(): express.Express {
    const app = express();
    app.use('/api', requireCustomHeader);
    app.get('/api/thing', (_req, res) => res.status(200).json({ ok: true }));
    app.post('/api/thing', (_req, res) => res.status(200).json({ ok: true }));
    return app;
  }

  it('should 403 a mutating /api request without the header', async () => {
    const res = await request(buildApp()).post('/api/thing');
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'Forbidden', code: 'FORBIDDEN' });
  });

  it('should pass a mutating /api request through with the header', async () => {
    const res = await request(buildApp()).post('/api/thing').set('X-Requested-With', 'share2brain');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('should not require the header on a GET /api request', async () => {
    const res = await request(buildApp()).get('/api/thing');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});
