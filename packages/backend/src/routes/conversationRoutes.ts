// Routes: mount the conversation controller on an Express router. Mounted at
// /api/conversations by the composition root (app.ts), AFTER the generic /api gate,
// so it inherits requireAuth + the RBAC middleware — do NOT re-add them here. The
// RBAC channel scope is irrelevant for conversations (owned by userId, D2) but the
// middleware still runs because the routes sit under /api. Mirrors documentRoutes.ts.
import { Router } from 'express';

import type { ConversationController } from '../presentation/controllers/conversationController.js';
import { asyncHandler } from './asyncHandler.js';

export function createConversationRouter(controller: ConversationController): Router {
  const router = Router();
  router.get('/', asyncHandler((req, res) => controller.list(req, res)));
  router.get('/:conversationId', asyncHandler((req, res) => controller.getById(req, res)));
  return router;
}
