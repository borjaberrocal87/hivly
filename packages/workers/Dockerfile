# @share2brain/workers image. Build context MUST be the repo root (see the story's Dev
# Notes): @share2brain/shared is consumed as raw source, so the image needs
# packages/shared/src plus the root lockfile for `npm ci`. tsx is the runtime.
FROM node:24-alpine

WORKDIR /app

# Manifests first so `npm ci` is cached until a dependency actually changes.
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/backend/package.json ./packages/backend/
COPY packages/bot/package.json ./packages/bot/
COPY packages/workers/package.json ./packages/workers/
COPY packages/web/package.json ./packages/web/
RUN npm ci

COPY tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY packages/workers ./packages/workers

# M-13: drop root. node:*-alpine ships a built-in unprivileged `node` user (uid
# 1000). All COPY'd sources and `npm ci` output are world-readable, so tsx can
# still read /app at runtime; no chown needed.
USER node

# Run from /app so loadConfig() finds the mounted /app/Share2Brain.config.yml (cwd).
CMD ["npx", "tsx", "packages/workers/src/main.ts"]
