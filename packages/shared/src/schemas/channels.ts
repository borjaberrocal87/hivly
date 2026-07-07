// Channels API contract (AD-6). GET /api/channels returns the channels the
// caller's Discord roles can access (RBAC array-overlap inside the query, AD-12).
import { z } from 'zod';

export const ChannelSchema = z.object({ id: z.string(), name: z.string() });
export type Channel = z.infer<typeof ChannelSchema>;

export const ChannelsResponseSchema = z.object({ channels: z.array(ChannelSchema) });
export type ChannelsResponse = z.infer<typeof ChannelsResponseSchema>;

export const CHANNELS_ERROR = { INTERNAL: 'INTERNAL' } as const;
export type ChannelsErrorCode = (typeof CHANNELS_ERROR)[keyof typeof CHANNELS_ERROR];
