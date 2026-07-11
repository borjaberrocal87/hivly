// Routes: mount the auth controller handlers on an Express router. Mounted at
// /api/auth by the composition root (app.ts).
import { Router } from 'express';

import { requireAuth } from '../middleware/requireAuth.js';
import type { AuthController } from '../presentation/controllers/authController.js';
import { asyncHandler } from './asyncHandler.js';

export function createAuthRouter(controller: AuthController): Router {
  const router = Router();
  router.get('/login', (req, res) => controller.login(req, res));
  router.get('/callback', asyncHandler((req, res) => controller.callback(req, res)));
  router.get('/me', asyncHandler((req, res) => controller.me(req, res)));
  // /roles is under /api/auth → EXEMPT from the generic /api gate; it enforces
  // its own session check via route-level requireAuth (AC2 excludes /api/auth/*).
  router.get('/roles', requireAuth, asyncHandler((req, res) => controller.roles(req, res)));
  router.post('/logout', (req, res) => controller.logout(req, res));
  // Guest access (Story 2.5). Both public — the whole /api/auth mount is registered
  // BEFORE the generic gate, so they are exempt for free and inherit authLimiters.
  // The controller 404s both verbs when guest access is disabled (deps.guestAccess absent).
  router.get('/guest', (req, res) => controller.guestAvailability(req, res));
  router.post('/guest', asyncHandler((req, res) => controller.guestLogin(req, res)));
  return router;
}
