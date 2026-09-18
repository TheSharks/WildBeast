---
title: Development environment
description: Setting up a working environment, with or without the devcontainer.
sidebar:
  order: 2
---

Use the devcontainer to start with PostgreSQL, Redis, and a telemetry
collector already configured, or install the required services locally.

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

The setup script waits for PostgreSQL, installs dependencies, and applies
the database migrations. Add your `DISCORD_TOKEN` to `apps/discord/.env`
before starting the bot.

## Local setup

You need [Node.js](https://nodejs.org/) 22 or later,
[pnpm](https://pnpm.io/), a PostgreSQL database, and a Redis server
(defaults work). PostgreSQL is required: `DATABASE_URL` is validated at
boot and backs the tag system and the premium entitlement mirror. Redis
is required even for a single cluster: it backs the scheduled task queue,
identify rate limiting, and gateway session storage. An OTLP collector
is optional; telemetry export stays disabled without an endpoint.

```bash
git clone https://github.com/TheSharks/WildBeast.git
cd WildBeast
pnpm install
```

Follow [Getting started](/self-hosting/getting-started/#running-the-bot) to
set `DISCORD_TOKEN` and `DATABASE_URL` in `apps/discord/.env`, configure Redis,
and apply the database migrations before starting the bot.

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
the running cluster. Compiled output updates as you save, but the running
process doesn't reload it: stop the cluster with Ctrl+C and run `pnpm dev`
again to pick up a change. With `WILDBEAST_DEV_GUILD_ID` set, commands
register in that guild and the new definitions show up in Discord as soon
as the cluster is back.

For telemetry during development, `SENTRY_SPOTLIGHT=true` streams events to
a local [Spotlight](https://spotlightjs.com/) sidecar, and the
[observability stack](/self-hosting/dashboards/) under `contrib/grafana`
lets you view local metrics in Grafana and Prometheus, traces in Tempo,
and logs in Loki.

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
