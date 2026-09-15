# StockFlow

A minimal Inventory & Invoicing system. Monorepo with a NestJS API and a React (Vite) frontend, managed with pnpm workspaces and Turborepo.

> This README covers setup and day-to-day commands. Full docs (demo credentials, tech-choice write-up, trade-offs, AI usage) land once the core features are built.

## Layout

```
apps/
  api/      NestJS backend (http://localhost:3000) — Prisma + PostgreSQL
  web/      React + Vite frontend (http://localhost:5173) — Tailwind
packages/
  shared/   Shared TypeScript types used by both apps (@eterna/shared)
```

## Requirements

- Node.js >= 20
- pnpm (`corepack enable` or `npm i -g pnpm`)
- Docker (for the local PostgreSQL container) — or your own PostgreSQL instance

## Getting started

One `.env` at the repo root covers everything — Postgres, the API, and the web app all read from it. There's nothing per-app to copy.

```bash
pnpm install
cp .env.example .env                          # one file for the whole project — see comments in it
pnpm db:up                                     # starts Postgres in Docker
pnpm --filter @eterna/api run prisma:migrate   # applies the schema
pnpm dev                                       # runs api + web in parallel via Turborepo
```

- API: http://localhost:3000 (health check at `/health`, API docs at `/api/docs`)
- Web: http://localhost:5173

**Note:** `.env.example` defaults the Postgres port to `55432` rather than the standard `5432`/`5433`, because this project's dev machine already had native Postgres services bound to both. Change `POSTGRES_PORT` and the port inside `DATABASE_URL` together if you need a different one.

## Other commands

Every command below runs from the repo root and fans out to every app/package via Turborepo — no `cd` needed.

```bash
pnpm build      # build all apps/packages
pnpm lint       # lint all apps/packages
pnpm test       # unit tests (no DB needed)
pnpm test:e2e   # integration tests — no setup needed, no Docker/Postgres involved
```

`pnpm test:e2e` runs the API's integration tests against a disposable local SQLite file that's wiped and recreated on every run (`apps/api/prisma/setup-test-db.ts`). This is deliberately separate from dev/prod, which always use real Postgres — Prisma ties one schema file to one database provider, so a from-scratch SQLite file is the fastest way to get real integration tests without needing Docker just to run the test suite. There's no env file to copy for this: sensible defaults are baked into `apps/api/test/setup-env.ts`.

## Adding a new app or package

Create a new folder under `apps/` or `packages/` with its own `package.json` — pnpm workspaces (see `pnpm-workspace.yaml`) and Turborepo (`turbo.json`) will pick it up automatically. Reference shared code via `"@eterna/shared": "workspace:*"`.
