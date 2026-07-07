// Domain port: persistence contract for channel RBAC policy. Pure — no Drizzle,
// no SQL. The Drizzle implementation lives in infrastructure/ and satisfies this
// interface, so the application layer depends only on the contract (AD-2 spirit,
// backend-standards §Layered Architecture). Mirrors userRepository.ts (Story 2.3).

/** A channel permission rule as the domain cares about it (config → table row). */
export interface ChannelPermissionInput {
  channelId: string;
  name: string;
  allowedRoles: string[];
  categoryId?: string | null;
}

export interface ChannelPermissionRepository {
  /**
   * Insert or update the given channel permission rules, keyed on `channelId`
   * (the PK). Idempotent: re-running with the same config leaves one row per
   * channel. An empty input is a no-op. Called at startup to materialize the
   * RBAC policy from `config.access_control.channel_permissions`.
   */
  upsertMany(perms: ChannelPermissionInput[]): Promise<void>;

  /**
   * Resolve the channel IDs a user with the given Discord roles may access —
   * the rows whose `allowed_roles` overlap `discordRoles` (Postgres `&&`, AD-12).
   * Deny-by-default: no matching rule (or no roles) resolves to `[]`.
   */
  findAllowedChannelIds(discordRoles: string[]): Promise<string[]>;

  /**
   * Resolve the channels (id + name) a user with the given Discord roles may
   * access — the rows whose `allowed_roles` overlap `discordRoles` (Postgres
   * `&&`, AD-12). Deny-by-default: no matching rule (or no roles) resolves to `[]`.
   */
  findAllowedChannels(discordRoles: string[]): Promise<{ id: string; name: string }[]>;
}
