// Routes: mount the search controller on an Express router. Mounted at
// /api/search by the composition root (app.ts), AFTER the generic /api gate, so it
// inherits requireAuth + the RBAC middleware (req.allowedChannelIds) — do NOT
// re-add them here. Mirrors authRoutes.ts.
import { Router } from 'express';

import type { SearchController } from '../presentation/controllers/searchController.js';
import { asyncHandler } from './asyncHandler.js';

export function createSearchRouter(controller: SearchController): Router {
  const router = Router();
  router.get('/', asyncHandler((req, res) => controller.search(req, res)));
  return router;
}
