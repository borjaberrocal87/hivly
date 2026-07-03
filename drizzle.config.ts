// drizzle-kit configuration. The schema in packages/shared is the single source
// of truth (AD-5); migrations are emitted as explicit SQL into that package.
// `generate` does not need a live database — `dbCredentials` is only consulted
// by `migrate`/`push`/`studio`.
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './packages/shared/src/db/schema.ts',
  out: './packages/shared/src/db/migrations',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
