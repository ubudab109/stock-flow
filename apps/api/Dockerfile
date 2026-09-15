# syntax=docker/dockerfile:1
# Built from the monorepo root: docker build -f apps/api/Dockerfile .
FROM node:20-slim AS base
RUN corepack enable
# better-sqlite3 (a devDependency, used only by the local test tooling) has
# no prebuilt binary for every platform and falls back to compiling from
# source — node:20-slim ships neither Python nor a compiler.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /repo

FROM base AS deps
# Only manifests first, so this layer is cached until a dependency changes.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
# apps/api's postinstall hook runs `prisma generate` (and the SQLite test-db
# setup) as part of `pnpm install` itself — it needs the schema present, not
# just deferred to the later `COPY . .` in the build stage.
COPY apps/api/prisma apps/api/prisma
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
# `prisma generate` (part of `apps/api`'s build script) loads prisma.config.ts,
# which reads DATABASE_URL eagerly even though `generate` itself never
# connects to a database. The real value is injected at container *runtime*
# by docker-compose — this placeholder only satisfies that eager read here
# at build time.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
RUN pnpm --filter @eterna/shared run build
RUN pnpm --filter @eterna/api run build

FROM base AS runtime
ENV NODE_ENV=production
# Reuse the exact node_modules produced inside this same Linux build stage —
# never copy node_modules from the host, which may hold Windows/macOS
# binaries for native deps.
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/package.json /repo/pnpm-workspace.yaml ./
COPY --from=build /repo/packages/shared ./packages/shared
COPY --from=build /repo/apps/api ./apps/api
WORKDIR /repo/apps/api
EXPOSE 3000
# Applies any pending migrations against a fresh (or upgraded) database
# before starting — the `prisma` CLI is present because we reused the full
# node_modules from the build stage, devDependencies included.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
