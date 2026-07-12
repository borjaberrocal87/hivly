// Middleware: CSRF defense-in-depth (audit L-2). Every mutating request under
// /api must carry a non-empty `X-Requested-With` header. A cross-site HTML form
// (the classic CSRF vector) cannot set a custom request header, so requiring its
// mere presence rejects forged cross-origin POST/DELETE while the SPA — which
// sends `X-Requested-With: share2brain` on every mutating fetch — passes through.
// This is a SECOND layer behind SameSite=Lax, not a replacement for it.
//
// GET/HEAD/OPTIONS are exempt (safe/preflight methods carry no state change).
// Missing/empty → 403 in the unified ErrorSchema shape ({ error, code }).
import type { NextFunction, Request, Response } from 'express';

/** Methods that never mutate state — exempt from the custom-header requirement. */
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function requireCustomHeader(req: Request, res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }
  const header = req.get('X-Requested-With');
  if (!header || header.trim() === '') {
    res.status(403).json({ error: 'Forbidden', code: 'FORBIDDEN' });
    return;
  }
  next();
}
