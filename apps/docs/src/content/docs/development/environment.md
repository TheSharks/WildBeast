---
title: Development environment
description: Setting up a working environment, with or without the devcontainer.
sidebar:
  order: 2
---

Two ways to get a working environment: the devcontainer, which brings every
backing service with it, or a local setup where you provide Node.js and
Redis yourself.

## The devcontainer (recommended)

The repository ships a [devcontainer](https://containers.dev/) under
`.devcontainer/` that works in VS Code and GitHub Codespaces. Opening the
repo in it gives you:

- **PostgreSQL** (TimescaleDB, PostgreSQL 17) with a `wildbeast` database,
  reachable as `db:5432`. `DATABASE_URL` is pre-set.
- **Redis 8** at `redis:6379`, with `REDIS_HOST`/`REDIS_PORT` pre-set.
- **An OpenTelemetry collector** at `otel-collector:4317` (gRPC) and
  `:4318` (HTTP), with `OTEL_EXPORTER_OTLP_ENDPOINT` pre-set, so telemetry
  export works without any configuration.
- Editor extensions for Biome, `.env` files, SQL, and Sapphire's i18n
  key completion.

The setup script waits for PostgreSQL and runs `pnpm install`, so the
workspace is ready when the container is. The only thing you must add
yourself is a `DISCORD_TOKEN` in `apps/discord/.env`.

## Local setup

You need [Node.js](https://nodejs.org/) 22 or later,
[pnpm](https://pnpm.io/), and a Redis server (defaults work). PostgreSQL
and an OTLP collector are optional; nothing in the current bot requires
the database, and telemetry export stays disabled without an endpoint.

```bash
git clone https://github.com/TheSharks/WildBeast.git
cd WildBeast
pnpm install
```

Create `apps/discord/.env` with your `DISCORD_TOKEN` (see
[Configuration](/self-hosting/configuration/) for the rest).

## Everyday commands

All of these run from the repository root and fan out through Turborepo:

```bash
pnpm dev     # build, then run everything in watch mode
pnpm build   # compile all workspaces
pnpm test    # unit tests
pnpm lint    # Biome check (style + lint)
pnpm check:fix  # fix what Biome can fix automatically
```

`pnpm dev` for the bot runs the TypeScript compiler in watch mode next to
the running cluster. In development (`NODE_ENV` unset or `development`),
Sapphire's HMR plugin watches the compiled output and hot-reloads pieces,
so editing a command or listener takes effect without a restart. Changes
outside pieces (structures, sharding, the cluster manager) still need one.

For telemetry during development, `SENTRY_SPOTLIGHT=true` streams events to
a local [Spotlight](https://spotlightjs.com/) sidecar, and the
[observability stack](/self-hosting/dashboards/) under `contrib/grafana`
gives you the full Grafana/Prometheus/Tempo/Loki experience against your
local bot.

## The docs site

This site is an [Astro Starlight](https://starlight.astro.build/) app in
`apps/docs`:

```bash
pnpm --filter @thesharks/docs dev    # serve at localhost:4321
pnpm --filter @thesharks/docs build  # production build
```

The TagScript playground on the docs site imports the interpreter straight
from `packages/tagscript/src`, so language changes show up in the
playground without a rebuild.

## Next steps

- [Architecture](/development/architecture/) maps the workspace.
- [Writing pieces](/development/pieces/) covers adding commands, listeners,
  and tasks.
- [Testing](/development/testing/) explains the unit and integration
  suites.
