// Integration-test env bootstrap. The *.integration.test.ts specs open a REAL
// Postgres + Redis using DATABASE_URL / REDIS_URL (see each service's
// test-helpers). npm does NOT auto-load .env, so without this every integration
// run falls back to the `changeme` placeholder in test-helpers and fails auth
// against a real container (Postgres 28P01).
//
// Referenced as a `setupFiles` entry by the three integration vitest projects,
// so it runs in each worker before the specs (and before test-helpers reads the
// vars at module load). `process.loadEnvFile` does NOT override an already-set
// variable, so a CI that exports DATABASE_URL / REDIS_URL keeps precedence — the
// file only fills the gaps for a local `npm run test:integration`. Guarded on
// existence so a CI checkout without a .env just uses its real env vars.
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const envPath = resolve(dirname(fileURLToPath(import.meta.url)), '.env');
if (existsSync(envPath)) {
  process.loadEnvFile(envPath);
}
