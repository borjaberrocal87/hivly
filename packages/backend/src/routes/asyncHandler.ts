// Routes helper: wrap an async `(req, res) => Promise<void>` controller method so
// a rejected promise is forwarded to Express's error pipeline via `next(err)`
// instead of being discarded (M-3 audit).
//
// Every route previously used `(req, res) => void controller.x(req, res)`, which
// throws the returned promise away: an un-try/caught `await` in a controller then
// becomes an `unhandledRejection`, and main.ts's global handler turns that into
// `process.exit(1)` — a single bad request escalates into a crash-loop. Routing
// the rejection to `next` lets the final error-handling middleware (app.ts) map it
// to a clean 500 instead, so one request fails, not the whole process.
import type { NextFunction, Request, Response } from 'express';

/** Adapt an async controller method to an Express handler that forwards rejections to `next`. */
export function asyncHandler(
  fn: (req: Request, res: Response) => Promise<void>,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    fn(req, res).catch(next);
  };
}
