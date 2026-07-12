// Final Express error-handling middleware (M-3 audit). Mounted LAST in app.ts so it
// is the net for everything above it: rejections forwarded by asyncHandler from any
// controller, AND synchronous throws in earlier middleware — notably
// express.json()'s malformed-JSON SyntaxError, which without this would fall to
// Express's default handler (wrong body shape, and it may echo a stack trace).
import type { ErrorRequestHandler } from 'express';
import type { Logger } from '@share2brain/shared/logger';

/**
 * Build the terminal error handler. When a `logger` is injected it logs there;
 * otherwise it falls back to `console.error`, matching the style used across the
 * controllers. Responds with the unified ErrorSchema shape (`{ error, code }`) and a
 * generic, non-leaking `INTERNAL` code, but only when headers were NOT already sent —
 * an SSE response (POST /api/chat) may already be streaming, in which case it
 * delegates to Express's default handler to close the connection cleanly.
 */
export function createErrorHandler(logger?: Logger): ErrorRequestHandler {
  // The four-arg signature is what marks this as error-handling middleware.
  return (err, _req, res, next) => {
    const message = err instanceof Error ? err.message : String(err);
    if (logger) {
      logger.error('unhandled request error', { reason: message });
    } else {
      console.error('[app] unhandled request error:', message);
    }
    if (res.headersSent) {
      next(err);
      return;
    }
    res.status(500).json({ error: 'Internal error', code: 'INTERNAL' });
  };
}
