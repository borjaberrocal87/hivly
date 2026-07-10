// Routes: mount the stats controller on an Express router. Mounted at /api/stats
// by the composition root (app.ts), AFTER the generic /api gate, so it inherits
// requireAuth + the RBAC middleware — do NOT re-add them here. Mirrors
// documentRoutes.ts.
import { Router } from 'express';

import type { StatsController } from '../presentation/controllers/statsController.js';

export function createStatsRouter(controller: StatsController): Router {
  const router = Router();
  router.get('/', (req, res) => void controller.get(req, res));
  return router;
}
