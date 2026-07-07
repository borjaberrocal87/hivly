// Unit tests for the RBAC application service — the security boundary. Written
// tests-first (red → green): a user whose roles do NOT intersect a channel's
// allowed_roles must NOT receive that channel id. Uses a plain fake repository;
// no DB, no express (the service depends only on the domain port).
import { describe, expect, it, vi } from 'vitest';

import type {
  ChannelPermissionInput,
  ChannelPermissionRepository,
} from '../../domain/repositories/channelPermissionRepository.js';
import { createRbacService } from './rbacService.js';

/**
 * In-memory fake honoring the overlap semantics: findAllowedChannelIds returns
 * the channels whose allowedRoles intersect the given roles (deny-by-default).
 */
function fakeRepo(rules: ChannelPermissionInput[]): ChannelPermissionRepository {
  return {
    upsertMany: vi.fn(async () => undefined),
    findAllowedChannelIds: vi.fn(async (discordRoles: string[]) => {
      if (discordRoles.length === 0) return [];
      return rules
        .filter((r) => r.allowedRoles.some((role) => discordRoles.includes(role)))
        .map((r) => r.channelId);
    }),
    findAllowedChannels: vi.fn(async (discordRoles: string[]) => {
      if (discordRoles.length === 0) return [];
      return rules
        .filter((r) => r.allowedRoles.some((role) => discordRoles.includes(role)))
        .map((r) => ({ id: r.channelId, name: r.name }));
    }),
  };
}

const RULES: ChannelPermissionInput[] = [
  { channelId: 'chan-admin', name: 'admin-only', allowedRoles: ['admin'] },
  { channelId: 'chan-general', name: 'general', allowedRoles: ['admin', 'mod', 'member'] },
];

describe('rbacService.expandAllowedChannelIds', () => {
  it('should return the channels whose allowed_roles overlap the user roles', async () => {
    const rbac = createRbacService({ channelPermissions: fakeRepo(RULES) });

    const result = await rbac.expandAllowedChannelIds(['admin']);

    expect(result).toEqual(['chan-admin', 'chan-general']);
  });

  it('should NOT return a channel when the user roles do not intersect its allowed_roles', async () => {
    const rbac = createRbacService({ channelPermissions: fakeRepo(RULES) });

    const result = await rbac.expandAllowedChannelIds(['member']);

    expect(result).toContain('chan-general');
    expect(result).not.toContain('chan-admin');
  });

  it('should return [] for a user with no roles (deny-by-default)', async () => {
    const rbac = createRbacService({ channelPermissions: fakeRepo(RULES) });

    expect(await rbac.expandAllowedChannelIds([])).toEqual([]);
  });
});

describe('rbacService.getRolesResponse', () => {
  it('should return the parsed { roles, allowedChannels } shape', async () => {
    const rbac = createRbacService({ channelPermissions: fakeRepo(RULES) });

    const result = await rbac.getRolesResponse(['admin']);

    expect(result).toEqual({
      roles: ['admin'],
      allowedChannels: ['chan-admin', 'chan-general'],
    });
  });

  it('should echo empty arrays when the user has no roles', async () => {
    const rbac = createRbacService({ channelPermissions: fakeRepo(RULES) });

    expect(await rbac.getRolesResponse([])).toEqual({ roles: [], allowedChannels: [] });
  });
});

describe('rbacService.getAllowedChannels', () => {
  it('should return the channels whose allowed_roles overlap the user roles', async () => {
    const rbac = createRbacService({ channelPermissions: fakeRepo(RULES) });

    const result = await rbac.getAllowedChannels(['member']);

    expect(result).toEqual({ channels: [{ id: 'chan-general', name: 'general' }] });
  });

  it('should NOT return a channel when the user roles do not intersect its allowed_roles', async () => {
    const rbac = createRbacService({ channelPermissions: fakeRepo(RULES) });

    const result = await rbac.getAllowedChannels(['member']);

    expect(result.channels.map((c) => c.id)).not.toContain('chan-admin');
  });

  it('should return an empty channels array for a user with no roles (deny-by-default)', async () => {
    const rbac = createRbacService({ channelPermissions: fakeRepo(RULES) });

    expect(await rbac.getAllowedChannels([])).toEqual({ channels: [] });
  });
});
