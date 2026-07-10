// Application service: stats orchestration. Turns the caller's RBAC scope into a
// validated StatsResponse — computes the UTC 14-day window + week start,
// assembles the 4 KPIs (D3), zero-fills the activity series (D5), and computes
// readPct (AC5). Depends ONLY on the domain port (StatsRepository) — no
// Drizzle, no Express — so it is unit-testable with plain fakes. Mirrors
// documentService.ts.
import { StatsResponseSchema, type StatsResponse } from '@hivly/shared/schemas';

import type { StatsRepository } from '../../domain/repositories/statsRepository.js';

const ACTIVITY_WINDOW_DAYS = 14;
const WEEKLY_DELTA_DAYS = 7;

function utcDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** UTC midnight of `now`'s calendar day. */
function utcToday(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** The `ACTIVITY_WINDOW_DAYS` UTC dates ending today (inclusive), oldest first (AC4). */
function buildWindowDays(now: Date): string[] {
  const today = utcToday(now);
  return Array.from({ length: ACTIVITY_WINDOW_DAYS }, (_, i) => {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - (ACTIVITY_WINDOW_DAYS - 1 - i));
    return utcDateString(d);
  });
}

export interface StatsService {
  /**
   * Aggregate knowledge KPIs, 14-day activity, per-channel volume, and personal
   * read coverage for `userId`, restricted to `allowedChannelIds` (AD-12). An
   * empty scope short-circuits every channel-scoped read (D6) — KPIs 1-3 read
   * 0, activity is 14 zero days, channels is `[]`, coverage is `0/0/0` — while
   * the per-user `queries` KPI still runs. `now` defaults to the wall clock;
   * tests pass a fixed value for a deterministic window.
   */
  getStats(userId: string, allowedChannelIds: string[], now?: Date): Promise<StatsResponse>;
}

export function createStatsService(deps: { statsRepo: StatsRepository }): StatsService {
  const { statsRepo } = deps;

  return {
    async getStats(userId, allowedChannelIds, now = new Date()): Promise<StatsResponse> {
      const windowDays = buildWindowDays(now);
      const fromDate = `${windowDays[0]}T00:00:00.000Z`;
      const weekStart = new Date(now.getTime() - WEEKLY_DELTA_DAYS * 24 * 60 * 60 * 1000).toISOString();

      const scoped = allowedChannelIds.length === 0;

      const [kpiCounts, activityRows, channels, readCount, queries] = await Promise.all([
        scoped
          ? Promise.resolve({ resources: 0, resourcesThisWeek: 0, channels: 0, authors: 0 })
          : statsRepo.getScopedKpiCounts(allowedChannelIds, weekStart),
        scoped ? Promise.resolve([]) : statsRepo.getActivity(allowedChannelIds, fromDate),
        scoped ? Promise.resolve([]) : statsRepo.getChannelCounts(allowedChannelIds),
        scoped ? Promise.resolve(0) : statsRepo.getCoverageReadCount(userId, allowedChannelIds),
        statsRepo.countUserAgentQueries(userId), // D6: always runs, no channel scope
      ]);

      const countByDay = new Map(activityRows.map((row) => [row.day, row.count]));
      const activity = windowDays.map((date) => ({ date, count: countByDay.get(date) ?? 0 }));

      const totalCount = kpiCounts.resources;
      const readPct = totalCount === 0 ? 0 : Math.round((readCount / totalCount) * 100);

      const kpis = [
        {
          key: 'resources' as const,
          label: 'Recursos indexados',
          value: kpiCounts.resources,
          sub: `+${kpiCounts.resourcesThisWeek} esta semana`,
        },
        {
          key: 'channels' as const,
          label: 'Canales',
          value: kpiCounts.channels,
          sub: `de ${allowedChannelIds.length} accesibles`,
        },
        {
          key: 'authors' as const,
          label: 'Autores',
          value: kpiCounts.authors,
          sub: 'en tus canales',
        },
        {
          key: 'queries' as const,
          label: 'Tus consultas al agente',
          value: queries,
          sub: 'en total',
        },
      ];

      // Validate against the shared contract before it leaves the service (AD-6).
      return StatsResponseSchema.parse({
        kpis,
        activity,
        channels,
        coverage: { readCount, totalCount, readPct },
      });
    },
  };
}
