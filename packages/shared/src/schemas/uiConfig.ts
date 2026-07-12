// UI config API contract (AD-6). The response shape for GET /api/ui-config —
// the deployment's SPA language, resolved from Share2Brain.config.yml
// (`ui.language`, default "es" when the block is absent, Epic 10).
import { z } from 'zod';

/** GET /api/ui-config — UI configuration for the SPA (language). */
export const UiConfigResponseSchema = z.object({
  language: z.enum(['es', 'en']),
});

export type UiConfigResponse = z.infer<typeof UiConfigResponseSchema>;
