// Unit tests for the generic auth gate. AAA, behavior-driven names. Uses minimal
// Express req/res/next doubles — no real session store.
import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';

import { requireAuth } from './requireAuth.js';

/** Minimal res double capturing the status/json a 401 would emit. */
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

describe('requireAuth', () => {
  it('should respond 401 AUTH_REQUIRED when there is no session userId', () => {
    const req = { session: {} } as unknown as Request;
    const res = fakeRes();
    const next = vi.fn() as unknown as NextFunction;

    requireAuth(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: 'Unauthorized', code: 'AUTH_REQUIRED' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should call next() and not respond when a session userId is present', () => {
    const req = { session: { userId: 'u-1' } } as unknown as Request;
    const res = fakeRes();
    const next = vi.fn() as unknown as NextFunction;

    requireAuth(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should reject and destroy a guest session past its absolute expiry (L-3)', () => {
    const destroy = vi.fn();
    const req = {
      session: { userId: 'guest-1', isGuest: true, guestExpiresAt: Date.now() - 1000, destroy },
    } as unknown as Request;
    const res = fakeRes();
    const next = vi.fn() as unknown as NextFunction;

    requireAuth(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: 'Unauthorized', code: 'AUTH_REQUIRED' });
    expect(destroy).toHaveBeenCalledOnce();
    expect(next).not.toHaveBeenCalled();
  });

  it('should allow a guest session still within its absolute expiry (L-3)', () => {
    const destroy = vi.fn();
    const req = {
      session: { userId: 'guest-1', isGuest: true, guestExpiresAt: Date.now() + 60_000, destroy },
    } as unknown as Request;
    const res = fakeRes();
    const next = vi.fn() as unknown as NextFunction;

    requireAuth(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(destroy).not.toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should NOT apply the guest deadline to a non-guest session (L-3)', () => {
    // A stale guestExpiresAt on a non-guest session must be ignored entirely.
    const req = {
      session: { userId: 'u-1', guestExpiresAt: Date.now() - 1000 },
    } as unknown as Request;
    const res = fakeRes();
    const next = vi.fn() as unknown as NextFunction;

    requireAuth(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });
});
