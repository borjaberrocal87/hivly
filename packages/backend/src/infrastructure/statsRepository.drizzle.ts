// Infrastructure adapter: the ONLY file that knows the stats aggregation SQL. Uses
// the `sql`/`inArray` re-exported by @hivly/shared/db so the backend never
// imports drizzle-orm directly (AD-2). Every channel-scoped query embeds
// `inArray(channel_id, allowedChannelIds)` (AD-12) plus the D4 deleted-message
// exclusion predicate, copied verbatim from documentRepository.drizzle.ts.
import { inArray, sql, type Database } from '@hivly/shared/db';

import type {
  ActivityDay,
  ChannelCount,
  ScopedKpiCounts,
  StatsRepository,
} from '../domain/repositories/statsRepository.js';

export function createDrizzleStatsRepository(db: Database): StatsRepository {
  return {
    async getScopedKpiCounts(
      allowedChannelIds: string[],
      weekStart: string,
    ): Promise<ScopedKpiCounts> {
      // AC7-style deny-by-default: never build `= ANY('{}')` (inArray throws on []).
      if (allowedChannelIds.length === 0) {
        return { resources: 0, resourcesThisWeek: 0, channels: 0, authors: 0 };
      }

      const resourcesResult = await db.execute(sql`
        SELECT
          count(*)::int                                              AS "resources",
          count(*) FILTER (WHERE e.created_at >= ${weekStart})::int  AS "resourcesThisWeek",
          count(DISTINCT e.channel_id)::int                          AS "channels"
        FROM embeddings e
        WHERE ${inArray(sql`e.channel_id`, allowedChannelIds)}
          AND NOT EXISTS (
            SELECT 1 FROM discord_messages d
            WHERE d.id = ANY(e.message_ids) AND d.deleted_at IS NOT NULL
          )
      `);

      const authorsResult = await db.execute(sql`
        SELECT count(DISTINCT d.author_id)::int AS "authors"
        FROM embeddings e
        JOIN discord_messages d ON d.id = e.message_ids[1]
        WHERE ${inArray(sql`e.channel_id`, allowedChannelIds)}
          AND NOT EXISTS (
            SELECT 1 FROM discord_messages dd
            WHERE dd.id = ANY(e.message_ids) AND dd.deleted_at IS NOT NULL
          )
      `);

      const resourcesRow = resourcesResult.rows[0] as Record<string, unknown>;
      const authorsRow = authorsResult.rows[0] as Record<string, unknown>;

      return {
        resources: Number(resourcesRow.resources),
        resourcesThisWeek: Number(resourcesRow.resourcesThisWeek),
        channels: Number(resourcesRow.channels),
        authors: Number(authorsRow.authors),
      };
    },

    async getActivity(allowedChannelIds: string[], fromDate: string): Promise<ActivityDay[]> {
      if (allowedChannelIds.length === 0) return [];

      const result = await db.execute(sql`
        SELECT
          to_char((e.created_at AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD') AS "day",
          count(*)::int                                                 AS "count"
        FROM embeddings e
        WHERE ${inArray(sql`e.channel_id`, allowedChannelIds)}
          AND NOT EXISTS (
            SELECT 1 FROM discord_messages d
            WHERE d.id = ANY(e.message_ids) AND d.deleted_at IS NOT NULL
          )
          AND e.created_at >= ${fromDate}
        GROUP BY 1
      `);

      return result.rows.map((raw): ActivityDay => {
        const row = raw as Record<string, unknown>;
        return { day: String(row.day), count: Number(row.count) };
      });
    },

    async getChannelCounts(allowedChannelIds: string[]): Promise<ChannelCount[]> {
      if (allowedChannelIds.length === 0) return [];

      const result = await db.execute(sql`
        SELECT
          e.channel_id                          AS "channelId",
          COALESCE(cp.name, e.channel_id)       AS "channelName",
          count(*)::int                         AS "count"
        FROM embeddings e
        LEFT JOIN channel_permissions cp ON cp.channel_id = e.channel_id
        WHERE ${inArray(sql`e.channel_id`, allowedChannelIds)}
          AND NOT EXISTS (
            SELECT 1 FROM discord_messages d
            WHERE d.id = ANY(e.message_ids) AND d.deleted_at IS NOT NULL
          )
        GROUP BY e.channel_id, cp.name
        ORDER BY count DESC, e.channel_id ASC
      `);

      return result.rows.map((raw): ChannelCount => {
        const row = raw as Record<string, unknown>;
        return {
          channelId: String(row.channelId),
          channelName: String(row.channelName),
          count: Number(row.count),
        };
      });
    },

    async getCoverageReadCount(userId: string, allowedChannelIds: string[]): Promise<number> {
      if (allowedChannelIds.length === 0) return 0;

      const result = await db.execute(sql`
        SELECT count(*)::int AS "read"
        FROM user_read_status urs
        JOIN embeddings e ON e.id = urs.embedding_id
        WHERE urs.user_id = ${userId}
          AND ${inArray(sql`e.channel_id`, allowedChannelIds)}
          AND NOT EXISTS (
            SELECT 1 FROM discord_messages d
            WHERE d.id = ANY(e.message_ids) AND d.deleted_at IS NOT NULL
          )
      `);

      const row = result.rows[0] as Record<string, unknown> | undefined;
      return Number(row?.read ?? 0);
    },

    async countUserAgentQueries(userId: string, fromDate: string): Promise<number> {
      // D3/D6: per-user data, no `channel_id` column to scope by — always runs,
      // even when the caller has an empty channel scope. Windowed to `fromDate`
      // (30 days, review decision 2026-07-10) — the bound is computed by the
      // service from its `now`, so the whole response is anchored to one clock.
      const result = await db.execute(sql`
        SELECT count(*)::int AS "queries"
        FROM messages m
        JOIN conversations c ON c.id = m.conversation_id
        WHERE c.user_id = ${userId}
          AND m.role = 'user'
          AND m.created_at >= ${fromDate}
      `);

      const row = result.rows[0] as Record<string, unknown> | undefined;
      return Number(row?.queries ?? 0);
    },
  };
}
