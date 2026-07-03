// Centralized behavior configuration (AD-8). loadConfig() reads Hivly.config.yml,
// interpolates ${ENV_VAR} references from process.env, and validates the result
// with Zod. On ANY failure it throws a descriptive ConfigError — the caller's
// main.ts is expected to abort BEFORE opening any DB/Redis/Discord connection.
// This module opens no network connections itself.
//
// Keys are snake_case to mirror the operator-authored YAML exactly. Secrets stay
// in .env and are referenced here as ${VAR}; behavior stays in YAML. Never mix.
import { readFileSync } from 'node:fs';

import { parse as parseYaml } from 'yaml';
import { z } from 'zod';

/** Thrown for any configuration failure: missing file, bad YAML, unset ${VAR}, or Zod validation. */
export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

const ChannelSchema = z.object({
  id: z.string(),
  name: z.string(),
  enabled: z.boolean(),
});

const ChannelPermissionSchema = z.object({
  channel_id: z.string(),
  name: z.string(),
  allowed_roles: z.array(z.string()),
});

export const HivlyConfigSchema = z.object({
  version: z.string(),
  discord: z.object({
    guild_id: z.string(),
    channels: z.array(ChannelSchema),
    backfill: z.object({
      enabled: z.boolean(),
      limit: z.number(),
      ignore_bots: z.boolean(),
    }),
  }),
  agent: z.object({
    provider: z.string(),
    model: z.string(),
    temperature: z.number(),
    max_iterations: z.number(),
    memory_window: z.number(),
  }),
  knowledge: z.object({
    chunk_size: z.number(),
    chunk_overlap: z.number(),
    grouping_window: z.number(),
    embedding_model: z.string(),
  }),
  sync: z.object({
    enabled: z.boolean(),
    sync_on_start: z.boolean(),
    delete_policy: z.enum(['soft', 'hard']),
  }),
  access_control: z.object({
    enabled: z.boolean(),
    default_policy: z.enum(['deny', 'allow']),
    role_cache_ttl: z.number(),
    channel_permissions: z.array(ChannelPermissionSchema),
  }),
  read_tracking: z.object({
    enabled: z.boolean(),
    auto_mark_read_on_click: z.boolean(),
  }),
  observability: z.object({
    sentry_dsn: z.string(),
    log_level: z.enum(['debug', 'info', 'warn', 'error']),
  }),
  security: z.object({
    rate_limit: z.object({
      window_ms: z.number(),
      max_requests: z.number(),
    }),
    allowed_origins: z.array(z.string()),
  }),
});

export type HivlyConfig = z.infer<typeof HivlyConfigSchema>;

const DEFAULT_CONFIG_FILE = 'Hivly.config.yml';
const ENV_PLACEHOLDER = /\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g;

/** Substitute ${ENV_VAR} placeholders from process.env; an unset var is a failure. */
function interpolateEnv(raw: string): string {
  return raw.replace(ENV_PLACEHOLDER, (_match, name: string) => {
    const value = process.env[name];
    if (value === undefined) {
      throw new ConfigError(
        `Environment variable \${${name}} referenced in config is not set. ` +
          `Add ${name} to your .env before starting.`,
      );
    }
    return value;
  });
}

/** Turn a ZodError into a single readable "path: message" list. */
function formatZodError(error: z.ZodError): string {
  const details = error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join('.') : '(root)';
      return `  - ${path}: ${issue.message}`;
    })
    .join('\n');
  return `Invalid Hivly configuration:\n${details}`;
}

/**
 * Load, interpolate, and validate the Hivly behavior configuration.
 *
 * Path resolution: `configPath` arg → `HIVLY_CONFIG_PATH` env →
 * `Hivly.config.yml` in the current working directory (Compose mounts it at
 * `/app/Hivly.config.yml`).
 *
 * @throws {ConfigError} on a missing file, malformed YAML, an unset referenced
 *   env var, or a schema validation failure. Never opens a network connection.
 */
export function loadConfig(configPath?: string): HivlyConfig {
  const path = configPath ?? process.env.HIVLY_CONFIG_PATH ?? DEFAULT_CONFIG_FILE;

  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : String(cause);
    throw new ConfigError(`Could not read config file at "${path}": ${reason}`);
  }

  const interpolated = interpolateEnv(raw);

  let parsed: unknown;
  try {
    parsed = parseYaml(interpolated);
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : String(cause);
    throw new ConfigError(`Malformed YAML in config file "${path}": ${reason}`);
  }

  const result = HivlyConfigSchema.safeParse(parsed);
  if (!result.success) {
    throw new ConfigError(formatZodError(result.error));
  }

  return result.data;
}
