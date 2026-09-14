# eterna-test

Monorepo with a NestJS API and a React (Vite) frontend, managed with pnpm workspaces and Turborepo.

## Layout

```
apps/
  api/      NestJS backend (http://localhost:3000)
  web/      React + Vite frontend (http://localhost:5173)
packages/
  shared/   Shared TypeScript types used by both apps (@eterna/shared)
```

## Requirements

- Node.js >= 20
- pnpm (`corepack enable` or `npm i -g pnpm`)

## Getting started

```bash
pnpm install
pnpm dev      # runs api + web in parallel via Turborepo
```

- API: http://localhost:3000 (health check at `/health`)
- Web: http://localhost:5173

Copy `apps/web/.env.example` to `apps/web/.env` to override `VITE_API_URL` if the API runs on a different host/port.

## Other commands

```bash
pnpm build    # build all apps/packages
pnpm lint     # lint all apps/packages
pnpm test     # test all apps/packages
```

## Adding a new app or package

Create a new folder under `apps/` or `packages/` with its own `package.json` — pnpm workspaces (see `pnpm-workspace.yaml`) and Turborepo (`turbo.json`) will pick it up automatically. Reference shared code via `"@eterna/shared": "workspace:*"`.
