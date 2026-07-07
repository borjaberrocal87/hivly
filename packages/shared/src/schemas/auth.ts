// Auth API contract (AD-6). The response shape for GET /api/auth/me plus the
// stable error codes the auth endpoints emit. Kept in shared so the web app can
// reference them via z.infer / the AUTH_ERROR map instead of hardcoding strings.
import { z } from 'zod';

/** GET /api/auth/me — the authenticated user's public profile. */
export const AuthMeResponseSchema = z.object({
  id: z.uuid(),
  discordId: z.string(),
  username: z.string(),
  avatar: z.string().nullable(),
  guildId: z.string().min(1), // Discord guild snowflake; empty would break "ver en Discord" links.
});

export type AuthMeResponse = z.infer<typeof AuthMeResponseSchema>;

/**
 * GET /api/auth/roles — the authenticated user's Discord roles and the channel
 * IDs they may access (RBAC expansion result). `allowedChannels` is computed
 * per-request from `channel_permissions`, never cached in the session.
 */
export const AuthRolesResponseSchema = z.object({
  roles: z.array(z.string()),
  allowedChannels: z.array(z.string()),
});

export type AuthRolesResponse = z.infer<typeof AuthRolesResponseSchema>;

/** Stable error `code`s emitted by the auth endpoints (paired with ErrorSchema). */
export const AUTH_ERROR = {
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  GUILD_MEMBER_REQUIRED: 'GUILD_MEMBER_REQUIRED',
  INVALID_OAUTH_STATE: 'INVALID_OAUTH_STATE',
  OAUTH_CALLBACK_FAILED: 'OAUTH_CALLBACK_FAILED',
  LOGOUT_FAILED: 'LOGOUT_FAILED',
  RBAC_EXPANSION_FAILED: 'RBAC_EXPANSION_FAILED',
  INTERNAL: 'INTERNAL',
} as const;

export type AuthErrorCode = (typeof AUTH_ERROR)[keyof typeof AUTH_ERROR];
