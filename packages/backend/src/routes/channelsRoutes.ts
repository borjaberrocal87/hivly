// Routes: mount the channels controller on an Express router. Mounted at
// /api/channels by the composition root (app.ts), AFTER the generic /api gate, so
// it inherits requireAuth + the RBAC middleware — do NOT re-add them here.
// Mirrors searchRoutes.ts.
import { Router } from 'express';

import type { ChannelsController } from '../presentation/controllers/channelsController.js';

export function createChannelsRouter(controller: ChannelsController): Router {
  const router = Router();
  router.get('/', (req, res) => void controller.list(req, res));
  return router;
}
