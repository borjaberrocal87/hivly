import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { loadConfig } from './index.js';

const VALID_YAML = `
version: "1.0"
discord:
  guild_id: "111111111111111111"
  channels:
    - id: "1234567890"
      name: "general"
      enabled: true
  backfill:
    enabled: true
    limit: 1000
    ignore_bots: true
agent:
  provider: "anthropic"
  model: "claude-sonnet-4-6"
  temperature: 0.7
  max_iterations: 10
  memory_window: 20
knowledge:
  chunk_size: 500
  chunk_overlap: 50
  grouping_window: 10
  embedding_model: "text-embedding-3-small"
sync:
  enabled: true
  sync_on_start: true
  delete_policy: "soft"
access_control:
  enabled: true
  default_policy: "deny"
  role_cache_ttl: 300
  channel_permissions:
    - channel_id: "1234567890"
      name: "general"
      allowed_roles: ["admin", "member"]
read_tracking:
  enabled: true
  auto_mark_read_on_click: true
observability:
  sentry_dsn: ""
  log_level: "info"
security:
  rate_limit:
    window_ms: 60000
    max_requests: 20
  allowed_origins:
    - "http://localhost:5173"
`;

describe('loadConfig', () => {
  let dir: string;

  const writeFixture = (name: string, content: string): string => {
    const path = join(dir, name);
    writeFileSync(path, content, 'utf8');
    return path;
  };

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'hivly-config-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('should return a typed, validated config when the YAML is valid', () => {
    const path = writeFixture('valid.yml', VALID_YAML);

    const config = loadConfig(path);

    expect(config.version).toBe('1.0');
    expect(config.discord.guild_id).toBe('111111111111111111');
    expect(config.discord.channels).toHaveLength(1);
    expect(config.agent.temperature).toBe(0.7);
    expect(config.sync.delete_policy).toBe('soft');
    expect(config.access_control.default_policy).toBe('deny');
    expect(config.observability.log_level).toBe('info');
    expect(config.security.rate_limit.max_requests).toBe(20);
  });

  it('should interpolate ${ENV_VAR} placeholders from process.env', () => {
    const previous = process.env.DISCORD_GUILD_ID;
    process.env.DISCORD_GUILD_ID = '999999999999999999';
    try {
      const yaml = VALID_YAML.replace('"111111111111111111"', '"${DISCORD_GUILD_ID}"');
      const path = writeFixture('interp.yml', yaml);

      const config = loadConfig(path);

      expect(config.discord.guild_id).toBe('999999999999999999');
    } finally {
      if (previous === undefined) delete process.env.DISCORD_GUILD_ID;
      else process.env.DISCORD_GUILD_ID = previous;
    }
  });

  it('should throw a descriptive error when a referenced env var is unset', () => {
    delete process.env.HIVLY_TEST_UNSET_VAR;
    const yaml = VALID_YAML.replace('"111111111111111111"', '"${HIVLY_TEST_UNSET_VAR}"');
    const path = writeFixture('unset.yml', yaml);

    expect(() => loadConfig(path)).toThrow(/HIVLY_TEST_UNSET_VAR/);
  });

  it('should throw a descriptive error when a required key is missing', () => {
    const yaml = VALID_YAML.replace(/agent:[\s\S]*?memory_window: 20\n/, '');
    const path = writeFixture('missing-key.yml', yaml);

    expect(() => loadConfig(path)).toThrow(/agent/);
  });

  it('should throw when the YAML is malformed', () => {
    const path = writeFixture('bad.yml', 'version: "1.0"\n  : : : not valid yaml :');

    expect(() => loadConfig(path)).toThrow();
  });

  it('should throw when the config file does not exist', () => {
    expect(() => loadConfig(join(dir, 'does-not-exist.yml'))).toThrow();
  });
});
