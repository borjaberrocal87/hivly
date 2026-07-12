// Infrastructure adapter: DiscordOAuthClient port implemented against the Discord
// REST API with the global fetch (Node 24+). discord.js is intentionally NOT used
// here — that library is for the bot's Gateway connection; the backend only needs
// these three REST calls of the OAuth2 flow.
import { z } from 'zod';

import type {
  DiscordGuildMember,
  DiscordOAuthClient,
  DiscordUser,
} from '../domain/repositories/discordOAuthClient.js';

const DISCORD_API = 'https://discord.com/api';
const FETCH_TIMEOUT_MS = 10_000;

// L-4 (audit): validate the Discord REST responses at the boundary instead of
// blindly casting (mirrors the validated exchangeCode path). A malformed shape
// (missing id, non-string roles) then fails cleanly here rather than propagating
// an `undefined` id or a non-string role deeper into auth/RBAC. Extra fields are
// tolerated (Discord returns many we don't consume).
const DiscordUserResponseSchema = z.object({
  id: z.string(),
  username: z.string(),
  avatar: z.string().nullish(),
});

const DiscordGuildMemberResponseSchema = z.object({
  roles: z.array(z.string()),
});

export function createFetchDiscordOAuthClient(cfg: {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): DiscordOAuthClient {
  return {
    async exchangeCode(code: string): Promise<{ accessToken: string }> {
      const body = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: cfg.redirectUri,
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
      });
      const res = await fetch(`${DISCORD_API}/oauth2/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!res.ok) {
        throw new Error(`Discord token exchange failed (${res.status})`);
      }
      const json = (await res.json()) as Record<string, unknown>;
      // P4: validate the response shape instead of blindly casting.
      if (typeof json.access_token !== 'string') {
        throw new Error('Discord token response missing access_token');
      }
      return { accessToken: json.access_token };
    },

    async getCurrentUser(accessToken: string): Promise<DiscordUser> {
      const res = await fetch(`${DISCORD_API}/users/@me`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!res.ok) {
        throw new Error(`Discord user fetch failed (${res.status})`);
      }
      const parsed = DiscordUserResponseSchema.safeParse(await res.json());
      if (!parsed.success) {
        throw new Error('Discord user response has an invalid shape');
      }
      return { id: parsed.data.id, username: parsed.data.username, avatar: parsed.data.avatar ?? null };
    },

    async getGuildMember(
      accessToken: string,
      guildId: string,
    ): Promise<DiscordGuildMember | null> {
      const res = await fetch(`${DISCORD_API}/users/@me/guilds/${guildId}/member`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      // 404 = the authenticated user is not a member of the guild.
      if (res.status === 404) {
        return null;
      }
      if (!res.ok) {
        throw new Error(`Discord guild member fetch failed (${res.status})`);
      }
      const parsed = DiscordGuildMemberResponseSchema.safeParse(await res.json());
      if (!parsed.success) {
        throw new Error('Discord guild member response has invalid roles');
      }
      return { roles: parsed.data.roles };
    },
  };
}
