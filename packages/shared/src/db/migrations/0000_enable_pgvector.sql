-- Custom SQL migration file, put your code below! --

-- pgvector must exist before the `embeddings.embedding` vector column is created.
-- drizzle-kit does NOT emit CREATE EXTENSION, so this custom migration provides it
-- and is ordered (0000) before the generated schema migration.
CREATE EXTENSION IF NOT EXISTS vector;
