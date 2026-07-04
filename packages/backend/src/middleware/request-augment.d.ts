// The ONE place `allowedChannelIds` is typed on the Express request. Populated
// per-request by the RBAC middleware (rbac.ts) and read by downstream handlers
// (Epic 4/5 vector queries). Mirrors how SessionData is augmented once in
// sessionStore.ts. Undefined until the RBAC middleware has run.
import 'express-serve-static-core';

declare module 'express-serve-static-core' {
  interface Request {
    allowedChannelIds?: string[];
  }
}
