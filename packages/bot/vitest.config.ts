// Bot integration test project. These specs hit a REAL Postgres + Redis — bring
// them up first:
//
//   docker compose up -d postgres redis
//   npm run test:integration
//
// Connection strings come from DATABASE_URL / REDIS_URL, defaulting to the dev
// ports Compose exposes on localhost (see src/test-helpers.ts). Excluded from the
// default unit run so CI without infra stays green.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'bot-integration',
    root: import.meta.dirname,
    include: ['src/**/*.integration.test.ts'],
    // Load the repo-root .env (DATABASE_URL / REDIS_URL) before the specs run;
    // CI env vars still win (see the setup file).
    setupFiles: ['../../vitest.integration-setup.ts'],
    // Real sockets can be slow to open on a cold container; be generous.
    testTimeout: 15_000,
    hookTimeout: 15_000,
  },
});
