// CSRF defense-in-depth (L-10). The backend REQUIRES this header on every
// mutating (non-GET) /api request and returns 403 without it. A cross-origin
// page cannot set a custom request header on a "simple" request without
// triggering a CORS preflight the backend does not grant, so the header's
// presence proves the call came from our own same-origin SPA.
//
// Spread it into the `headers` of every POST/DELETE fetch (merging with any
// Content-Type); GET requests do not need it. Defined here once so the value
// stays in lockstep with the backend.
export const CSRF_HEADER = { 'X-Requested-With': 'share2brain' } as const;
