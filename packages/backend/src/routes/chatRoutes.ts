// Routes: mount the chat controller on an Express router. Mounted at /api/chat
// by the composition root (app.ts), AFTER the generic /api gate, so it inherits
// requireAuth + the RBAC middleware (req.allowedChannelIds) — do NOT re-add
// them here. Mirrors searchRoutes.ts.
import { Router } from 'express';

import type { ChatController } from '../presentation/controllers/chatController.js';

export function createChatRouter(controller: ChatController): Router {
  const router = Router();
  router.post('/', (req, res) => void controller.chat(req, res));
  return router;
}
