// Routes: mount the channels controller on an Express router. Mounted at
// /api/channels by the composition root (app.ts), AFTER the generic /api gate, so
// it inherits requireAuth + the RBAC middleware — do NOT re-add them here.
// Mirrors searchRoutes.ts.
import { Router } from 'express';

import type { ChannelsController } from '../presentation/controllers/channelsController.js';
import { asyncHandler } from './asyncHandler.js';

export function createChannelsRouter(controller: ChannelsController): Router {
  const router = Router();
  router.get('/', asyncHandler((req, res) => controller.list(req, res)));
  return router;
}
