// Middleware: the generic auth gate. Any request reaching it without a valid
// Redis session (no `userId`) is rejected with 401 AUTH_REQUIRED in the shared
// ErrorSchema shape. Mounted on `/api` (after the auth router) so it guards every
// non-auth API route, and reused route-level on /api/auth/roles (AC2, AC4).
import { AUTH_ERROR } from '@share2brain/shared/schemas';
import type { NextFunction, Request, Response } from 'express';

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.session.userId) {
    res.status(401).json({ error: 'Unauthorized', code: AUTH_ERROR.AUTH_REQUIRED });
    return;
  }
  // L-3 (audit): enforce the ABSOLUTE guest deadline. The cookie/store TTL is
  // sliding (renewed every request by store.touch()), so without this an active
  // guest never expires. Once past the deadline, destroy the session (delete the
  // Redis key) and reject 401. Non-guest sessions have no guestExpiresAt and skip
  // this branch entirely. The 401 is sent regardless of whether destroy succeeds.
  if (req.session.isGuest === true && typeof req.session.guestExpiresAt === 'number' && Date.now() > req.session.guestExpiresAt) {
    req.session.destroy((err: unknown) => {
      if (err) {
        console.error('[auth] guest session destroy failed:', err instanceof Error ? err.message : String(err));
      }
    });
    res.status(401).json({ error: 'Unauthorized', code: AUTH_ERROR.AUTH_REQUIRED });
    return;
  }
  next();
}
