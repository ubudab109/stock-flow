# StockFlow

A minimal Inventory & Invoicing system. Monorepo with a NestJS API and a React (Vite) frontend, managed with pnpm workspaces and Turborepo.

> This README covers the monorepo scaffold. Full setup/usage docs (env vars, demo credentials, tech choices, trade-offs) land once the core features are built — see the project plan.

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

```bash
pnpm install
cp .env.example .env                       # docker-compose Postgres credentials
cp apps/api/.env.example apps/api/.env      # API runtime config — see comments in the file
pnpm db:up                                  # starts Postgres in Docker
pnpm --filter @eterna/api run prisma:migrate  # applies the schema
pnpm dev                                    # runs api + web in parallel via Turborepo
```

- API: http://localhost:3000 (health check at `/health`, API docs at `/api/docs`)
- Web: http://localhost:5173

Copy `apps/web/.env.example` to `apps/web/.env` to override `VITE_API_URL` if the API runs on a different host/port.

**Note:** `apps/api/.env.example` defaults the Postgres port to `55432` rather than the standard `5432`/`5433`, because this project's dev machine already had native Postgres services bound to both. Adjust `POSTGRES_PORT` (root `.env`) and the port in `DATABASE_URL` (`apps/api/.env`) together if you need a different port.

## Other commands

```bash
pnpm build    # build all apps/packages
pnpm lint     # lint all apps/packages
pnpm test     # unit tests for all apps/packages
```

## Running the API's tests

```bash
cd apps/api
cp .env.test.example .env.test   # separate DB so tests never touch dev data
pnpm test          # unit tests (no DB required)
pnpm test:e2e      # integration tests — auto-creates/migrates the test DB first
```

## Adding a new app or package

Create a new folder under `apps/` or `packages/` with its own `package.json` — pnpm workspaces (see `pnpm-workspace.yaml`) and Turborepo (`turbo.json`) will pick it up automatically. Reference shared code via `"@eterna/shared": "workspace:*"`.
