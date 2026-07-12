// Routes: mount the chat controller on an Express router. Mounted at /api/chat
// by the composition root (app.ts), AFTER the generic /api gate, so it inherits
// requireAuth + the RBAC middleware (req.allowedChannelIds) — do NOT re-add
// them here. Mirrors searchRoutes.ts.
import { Router } from 'express';

import type { ChatController } from '../presentation/controllers/chatController.js';
import { asyncHandler } from './asyncHandler.js';

export function createChatRouter(controller: ChatController): Router {
  const router = Router();
  // SSE: chatController owns its own mid-stream error handling once headers are
  // flushed. asyncHandler still catches a PRE-stream rejection (before flushHeaders)
  // and routes it to the final error middleware, whose res.headersSent guard makes
  // it a no-op if streaming already started.
  router.post('/', asyncHandler((req, res) => controller.chat(req, res)));
  return router;
}
