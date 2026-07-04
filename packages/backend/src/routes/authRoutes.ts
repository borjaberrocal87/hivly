// Routes: mount the auth controller handlers on an Express router. Mounted at
// /api/auth by the composition root (app.ts).
import { Router } from 'express';

import { requireAuth } from '../middleware/requireAuth.js';
import type { AuthController } from '../presentation/controllers/authController.js';

export function createAuthRouter(controller: AuthController): Router {
  const router = Router();
  router.get('/login', (req, res) => controller.login(req, res));
  router.get('/callback', (req, res) => void controller.callback(req, res));
  router.get('/me', (req, res) => void controller.me(req, res));
  // /roles is under /api/auth → EXEMPT from the generic /api gate; it enforces
  // its own session check via route-level requireAuth (AC2 excludes /api/auth/*).
  router.get('/roles', requireAuth, (req, res) => void controller.roles(req, res));
  router.post('/logout', (req, res) => controller.logout(req, res));
  return router;
}
