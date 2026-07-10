// Stats API contract (AD-6). Response shape for GET /api/stats plus the stable error
// codes the endpoint emits. No links in this contract → does NOT import linkRefine.
import { z } from 'zod';

/** One KPI tile: fixed key/order `resources · channels · authors · queries` (D3). */
export const StatsKpiSchema = z.object({
  key: z.enum(['resources', 'channels', 'authors', 'queries']),
  label: z.string().min(1),
  value: z.number().int().min(0),
  sub: z.string(),
});

export type StatsKpi = z.infer<typeof StatsKpiSchema>;

/** One day of the 14-day indexing activity series (D5 — zero-filled in the service). */
export const StatsActivityPointSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  count: z.number().int().min(0),
});

export type StatsActivityPoint = z.infer<typeof StatsActivityPointSchema>;

/** One per-channel volume row, ordered `count DESC, channelId ASC` (D7). */
export const StatsChannelSchema = z.object({
  channelId: z.string().min(1),
  channelName: z.string(),
  count: z.number().int().min(0),
});

export type StatsChannel = z.infer<typeof StatsChannelSchema>;

/** Personal read coverage over the caller's scoped resources (AC5). */
export const StatsCoverageSchema = z.object({
  readCount: z.number().int().min(0),
  totalCount: z.number().int().min(0),
  readPct: z.number().int().min(0).max(100),
});

export type StatsCoverage = z.infer<typeof StatsCoverageSchema>;

/** GET /api/stats — RBAC-scoped knowledge KPIs, activity, channel volume, and coverage. */
export const StatsResponseSchema = z.object({
  kpis: z.array(StatsKpiSchema).length(4),
  activity: z.array(StatsActivityPointSchema).length(14),
  channels: z.array(StatsChannelSchema),
  coverage: StatsCoverageSchema,
});

export type StatsResponse = z.infer<typeof StatsResponseSchema>;

/** Stable error `code`s emitted by the stats endpoint (paired with ErrorSchema). */
export const STATS_ERROR = {
  INTERNAL: 'INTERNAL',
} as const;

export type StatsErrorCode = (typeof STATS_ERROR)[keyof typeof STATS_ERROR];
