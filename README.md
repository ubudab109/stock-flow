# StockFlow

A minimal Inventory & Invoicing system for a small distribution business: staff sign in, maintain a product catalog, and raise invoices that decrement stock when issued and restore it when cancelled. Monorepo with a NestJS API and a React (Vite) frontend, managed with pnpm workspaces and Turborepo.

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
- Docker (for PostgreSQL, and optionally for running the whole app in containers) — or your own PostgreSQL instance

## Getting started (local dev)

One `.env` at the repo root covers everything — Postgres, the API, and the web app all read from it. There's nothing per-app to copy.

```bash
pnpm install
cp .env.example .env                          # one file for the whole project — see comments in it
pnpm db:up                                     # starts Postgres in Docker
pnpm --filter @eterna/api run prisma:migrate   # applies the schema
pnpm db:seed                                   # demo users + sample products (see below)
pnpm dev                                       # runs api + web in parallel via Turborepo
```

- API: http://localhost:3000 (health check at `/health`, interactive API docs at `/api/docs`)
- Web: http://localhost:5173

**Note:** `.env.example` defaults the Postgres port to `55432` rather than the standard `5432`/`5433`, because this project's dev machine already had native Postgres services bound to both. Change `POSTGRES_PORT` and the port inside `DATABASE_URL` together if you need a different one.

## Demo credentials

`pnpm db:seed` (idempotent — safe to run more than once) creates two accounts:

| Email | Password | Contents |
| --- | --- | --- |
| `demo@stockflow.test` | `Passw0rd!` | 10 Indonesian grocery/retail products — the account to click around in |
| `staff@stockflow.test` | `Passw0rd!` | 3 products in a separate catalog — log in as this account to see that each user only ever has their own workspace (A7) |

## Other commands

Every command below runs from the repo root and fans out to every app/package via Turborepo — no `cd` needed.

```bash
pnpm build      # build all apps/packages
pnpm lint       # lint all apps/packages (oxlint + a full TypeScript typecheck for the API)
pnpm test       # unit tests (no DB needed)
pnpm test:e2e   # integration tests — no setup needed, no Docker/Postgres involved
```

`pnpm test:e2e` runs the API's integration tests against a disposable local SQLite file that's wiped and recreated on every run (`apps/api/prisma/setup-test-db.ts`). This is deliberately separate from dev/prod, which always use real Postgres — Prisma ties one schema file to one database provider, so a from-scratch SQLite file is the fastest way to get real integration tests without needing Docker just to run the test suite. There's no env file to copy for this: sensible defaults are baked into `apps/api/test/setup-env.ts`.

## Running the whole app in Docker

`docker-compose.yml` also defines `api` and `web` services (bonus: "docker-compose up brings up app + database"), alongside the `db` service used for local dev.

```bash
cp .env.example .env      # if you haven't already
docker compose up --build
```

- Web: http://localhost:8080
- API: http://localhost:3000 (same port as local dev — don't run `pnpm dev` at the same time)

The `api` container runs `prisma migrate deploy` automatically on startup, so a fresh database volume gets its schema before the server starts. Seed it the same way as local dev, just via `docker compose exec`:

```bash
docker compose exec api pnpm db:seed
```

This is a secondary, from-scratch way to run the project (e.g. to prove it works with zero local Node setup) — day-to-day development is faster with `pnpm dev` against `docker compose up -d db` (just the database), since that gets hot reload instead of a rebuild-on-every-change container.

**Note:** the login cookie's `Secure` flag is tied to `WEB_ORIGIN` being `https://`, not to `NODE_ENV` — a `Secure` cookie is silently dropped by real browsers over plain HTTP, and this compose setup deploys over plain HTTP with no TLS termination (out of scope for a take-home bonus). Confirmed this actually matters by testing in a real browser, not just `curl`: the first version of this cookie logic passed every `curl` check while silently failing to persist a session in an actual browser.

## API documentation

Interactive Swagger UI is served at `/api/docs` once the API is running. Endpoint summary:

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| POST | `/auth/register` | — | Rate-limited by the global default (100/min) |
| POST | `/auth/login` | — | Rate-limited to 5/min per IP |
| POST | `/auth/logout` | ✓ | Revokes the session server-side |
| GET | `/auth/me` | ✓ | |
| GET/POST | `/products` | ✓ | List (paginated, `search`) / create |
| GET/PATCH/DELETE | `/products/:id` | ✓ | Delete blocked (409) if referenced by an invoice |
| GET/POST | `/invoices` | ✓ | List (paginated, `status`, `search`) / create (always starts `DRAFT`) |
| GET/PATCH | `/invoices/:id` | ✓ | PATCH only allowed while `DRAFT` |
| GET | `/invoices/:id/pdf` | ✓ | Downloads/prints the invoice as a PDF |
| POST | `/invoices/:id/issue` | ✓ | `DRAFT → ISSUED`, atomically decrements stock |
| POST | `/invoices/:id/pay` | ✓ | `ISSUED → PAID` |
| POST | `/invoices/:id/cancel` | ✓ | `DRAFT/ISSUED → CANCELLED`, restores stock if it was `ISSUED` |

All authenticated routes read a JWT from an httpOnly cookie set by `/auth/login` — Swagger UI's "Authorize" won't work for cookie auth, so exercise these either through the web app or with a client that keeps cookies (e.g. `curl -c/-b`, Postman with cookie jar enabled).

## Tech choices, and why

- **NestJS + strict TypeScript (no `any`)** — DI, guards, and pipes map directly onto the spec's cross-cutting requirements (auth-on-every-route, validation, per-user ownership) instead of hand-rolling middleware for each.
- **Prisma 7 + PostgreSQL** — type-safe queries and migrations; Postgres per the spec's hard requirement. Prisma 7 also switched to a driver-adapter architecture (`@prisma/adapter-pg`), which turned out to matter for keeping the app portable (see Trade-offs).
- **JWT in an httpOnly cookie, backed by a server-side revocable `Session` row** — a plain stateless JWT can't actually be invalidated on logout; storing the session server-side (keyed by the JWT's `sid` claim) makes logout a real revocation instead of "the client agrees to forget the cookie."
- **bcryptjs over native `bcrypt`/`argon2`** — this dev machine had no MSVC/Python build toolchain, and native-addon installs are exactly the kind of thing that silently breaks a grader's "clone and run" experience on a machine you don't control. bcryptjs is pure JS, same algorithm, zero native-build risk.
- **Money as whole-Rupiah integers, never floats** — IDR is a zero-decimal currency (like JPY/KRW), so "integer minor units" for this dataset is just the integer itself; every calculation (tax, totals, stock math) is integer arithmetic end to end.
- **Turborepo + pnpm workspaces** — one command (`build`/`lint`/`test`/`test:e2e`/`dev`) fans out to both apps from the repo root; adding a package doesn't require touching root scripts.
- **Tests run against a disposable local SQLite database, not Docker Postgres** — `pnpm test:e2e` needs zero setup and no Docker, while dev/prod remain exclusively Postgres. This surfaced two real bugs during development (Postgres-only `mode: "insensitive"` search, and a cross-module NestJS DI issue) that a Postgres-only test setup might have hidden until first deployment.
- **React Query for all server state on the frontend** — cache invalidation, loading/error state, and refetch-on-mutation for free, instead of hand-rolled `useEffect`/`useState` plumbing per page.
- **Zod + react-hook-form on the client, independently of server-side class-validator** — both layers validate on their own terms (A5 explicitly wants server-side enforcement, not just client-side), so client validation is a UX nicety, never the source of truth.
- **Tailwind v4, no component library** — utility CSS keeps the UI "plain and functional" (per the spec's own guidance) without a dependency on a design system that would need to be learned and themed.

## Trade-offs and known limitations

- **Product/invoice search is case-sensitive on Postgres.** Prisma's `mode: "insensitive"` filter is Postgres-only and throws at runtime against the SQLite client used in tests — verified this would break before writing the search code, so `contains` is used plain (case-sensitive on Postgres, incidentally case-insensitive-for-ASCII on SQLite by that engine's own default). A citext column or a raw `ILIKE` would fix this without weakening the test setup, at the cost of a Postgres-specific code path.
- **Deleting a product referenced by an invoice is blocked (409), not soft-deleted.** Simpler schema (no `deletedAt` filtering needed on every query), and the error is more informative than a silently-vanished row. This is the explicit "your choice, document it" option from the spec (I4).
- **No optimistic/pessimistic locking beyond the stock guard itself.** Issuing an invoice decrements stock via a single atomic conditional `UPDATE ... WHERE quantityOnHand >= ?` per product (verified this can't oversell under concurrent issues), but two concurrent edits to the *same* invoice aren't otherwise serialized — acceptable at this scale, not something I'd ship for a multi-writer production system.
- **No roles.** Every user is a single-role workspace (A7's "each user is their own workspace" is satisfied literally). ADMIN/STAFF was on the bonus list; not implemented.
- **Sessions don't rotate.** A single ~7-day session cookie, revocable on logout, no refresh-token rotation. Fine for an internal tool; a public-facing product would want rotation and a shorter access-token lifetime.
- **Rate limiting is login-only**, per the spec's specific ask, on top of a generous global default (100 req/min) for basic abuse protection everywhere else. It's disabled under `NODE_ENV=test` (the e2e suite logs in far more than 5 times/minute across its files) and was verified manually via repeated `curl` rather than covered by an automated test, for that same reason.
- **The invoice PDF is plain and unbranded** — one page, no logo, functional layout. It was the fastest way to produce a real downloadable PDF; a nicer template/branding pass would be one of the first things I'd add next.
- **Frontend bundle isn't code-split** (Vite warns it's over 500kB after minification). Fine at this scale; a larger app would lazy-load routes.

## What I'd do with one more week

- Roles (ADMIN/STAFF) and refresh-token rotation with a shorter-lived access token.
- A stock-movement ledger (append-only, one row per increment/decrement with a reason) — currently `quantityOnHand` is just mutated in place, which is correct but leaves no audit trail.
- Row-level locking (or Postgres `SELECT ... FOR UPDATE`) for true serialization of concurrent edits to the same invoice, beyond the stock-guard's atomic update.
- A nicer invoice PDF (branding, line-item wrapping for long product names, multi-page support).
- Playwright coverage for the frontend (everything in this submission was verified by actually driving the app in headless Chromium during development, but that verification isn't checked into the repo as a repeatable test suite).
- A CI pipeline (lint + both test suites on every PR) and a deployed demo URL.
- A citext-based (or raw `ILIKE`) case-insensitive search on Postgres, with the SQLite test path kept correct via a small provider-aware branch instead of the current lowest-common-denominator `contains`.

## AI usage

This project was built with **Claude Code** (Claude Sonnet 5) end-to-end — architecture, backend, frontend, tests, and this README were all AI-implemented, directed and reviewed by me throughout in an extended pair-programming style session rather than a single hands-off prompt. Concretely:

- I set the direction at each step (which feature next, the git/commit workflow, that I wanted end-to-end slices rather than backend-only passes, that tests should run against SQLite instead of requiring Docker, that products/invoices needed search, and the scope of this final docs/seed/bonus pass) and reviewed and committed every change myself rather than accepting anything unread.
- Claude did the implementation: schema/API/business-logic design within the direction I gave, wrote and ran the test suites, drove the actual app in a real (headless) browser to verify UI flows rather than assuming they worked, and caught several of its own bugs during that verification (a Postgres-only search filter that would've broken silently, a cross-module dependency-injection bug, a `Secure`-cookie flag that passed every `curl` check while silently breaking login in an actual browser, a Docker build ordering bug, and a stale-selector false alarm in its own test script that it re-verified rather than papering over).
- I corrected its process twice during the build: once when it shipped a backend-only slice without the matching UI, and once when its environment-file layout (a separate `.env` per app) was needlessly fragmented — both were fixed properly rather than patched around.

## Time spent
I've built this test for about 11 hours+. Using AI assistant Claude, I have developed and tested the entire application.
I've set the direction at each step (which feature next, the git/commit workflow, that I wanted end-to-end slices rather than backend-only passes, that tests should run against SQLite instead of requiring Docker, that products/invoices needed search, and the scope of this final docs/seed/bonus pass) and reviewed and committed every change myself rather than accepting anything unread.
Claude did the implementation: schema/API/business-logic design within the direction I gave, wrote and ran the test suites, drove the actual app in a real (headless) browser to verify UI flows rather than assuming they worked, and caught several of its own bugs during that verification (a Postgres-only search filter that would've broken silently, a cross-module dependency-injection bug, a `Secure`-cookie flag that passed every `curl` check while silently breaking login in an actual browser, a Docker build ordering bug, and a stale-selector false alarm in its own test script that it re-verified rather than papering over).
I corrected its process twice during the build: once when it shipped a backend-only slice without the matching UI, and once when its environment-file layout (a separate `.env` per app) was needlessly fragmented — both were fixed properly rather than patched around.

## Loom Short Explanation
[Link](https://www.loom.com/share/8a893fd09a6443d79b3a1e7567af721b)
