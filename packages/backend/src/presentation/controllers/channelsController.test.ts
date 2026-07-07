// Unit tests for the channels controller's HTTP mapping: 200 with the service
// payload, 500 mapped to ErrorSchema without leaking the underlying error, and
// roles defaulting to [] when the session has none. Uses fake req/res — no
// Express, no infra. Mirrors searchController.test.ts.
import type { Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';

import type { RbacService } from '../../application/services/rbacService.js';
import { createChannelsController } from './channelsController.js';

function fakeRes(): Response & { statusCode: number; body: unknown } {
  const res = {
    statusCode: 0,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res as unknown as Response & { statusCode: number; body: unknown };
}

function fakeReq(discordRoles?: string[]): Request {
  return { session: { discordRoles } } as unknown as Request;
}

const stubRbacService = (impl: RbacService['getAllowedChannels']): RbacService =>
  ({ getAllowedChannels: impl }) as unknown as RbacService;

describe('channelsController.list', () => {
  it('should return 200 with the service payload on success', async () => {
    const payload = { channels: [{ id: 'chan-1', name: 'general' }] };
    const getAllowedChannels = vi.fn(async () => payload);
    const controller = createChannelsController({ rbacService: stubRbacService(getAllowedChannels) });
    const res = fakeRes();

    await controller.list(fakeReq(['member']), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toBe(payload);
    expect(getAllowedChannels).toHaveBeenCalledWith(['member']);
  });

  it('should default the roles to [] when the session has none', async () => {
    const getAllowedChannels = vi.fn(async () => ({ channels: [] }));
    const controller = createChannelsController({ rbacService: stubRbacService(getAllowedChannels) });
    const res = fakeRes();

    await controller.list(fakeReq(undefined), res);

    expect(getAllowedChannels).toHaveBeenCalledWith([]);
  });

  it('should map a service error to 500 INTERNAL without leaking it', async () => {
    const getAllowedChannels = vi.fn(async () => {
      throw new Error('db exploded: secret internal detail');
    });
    const controller = createChannelsController({ rbacService: stubRbacService(getAllowedChannels) });
    const res = fakeRes();

    await controller.list(fakeReq(['member']), res);

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: 'Internal error', code: 'INTERNAL' });
    expect(JSON.stringify(res.body)).not.toContain('secret internal detail');
  });
});
