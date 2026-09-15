# syntax=docker/dockerfile:1
# Built from the monorepo root: docker build -f apps/web/Dockerfile .
FROM node:20-slim AS base
RUN corepack enable
# better-sqlite3 (a devDependency, used only by the API's local test tooling
# but present in the shared workspace lockfile) needs Python + a compiler to
# build from source — node:20-slim ships neither.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /repo

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
# apps/api's postinstall hook runs `prisma generate` as part of `pnpm
# install` itself (workspace installs run every package's postinstall) —
# needed here too even though this image never runs the API.
COPY apps/api/prisma apps/api/prisma
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
# Vite inlines env vars at build time, not runtime — this must be the URL the
# *browser* can reach (the host-published API port), not a Docker-internal
# service name like http://api:3000.
ARG VITE_API_URL=http://localhost:3000
ENV VITE_API_URL=$VITE_API_URL
RUN pnpm --filter @eterna/shared run build
RUN pnpm --filter @eterna/web run build

FROM nginx:alpine AS runtime
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
