---
title: Getting started
description: How to set up and run WildBeast.
sidebar:
  order: 1
---

Set up a local WildBeast instance with PostgreSQL and Redis, then start the
bot in development mode. Run the commands below from the repository root.

## Prerequisites

- [Node.js](https://nodejs.org/) 22 or later
- [pnpm](https://pnpm.io/)
- A [PostgreSQL](https://www.postgresql.org/) database, which backs the tag
  system and premium entitlements
- A [Redis](https://redis.io/) server, which backs the scheduled task queue,
  identify rate limiting, and gateway session storage, even with a single
  cluster. A local install with default settings works out of the box.
- A Discord bot token from the [Discord Developer Portal](https://discord.com/developers/applications)

## Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/TheSharks/WildBeast.git
cd WildBeast
pnpm install
```

## Running the bot

Create `apps/discord/.env` with at least your bot token and database URL
(see [Configuration](/self-hosting/configuration/) for everything else):

```bash
DISCORD_TOKEN=your-bot-token
DATABASE_URL=postgresql://user:password@localhost:5432/wildbeast
```

Replace `your-bot-token` and the database credentials with your own values.
The example uses Redis at `localhost:6379`; set `REDIS_URL` if yours runs
elsewhere.

Apply the database migrations before starting the bot. The migration command
reads `DATABASE_URL` from your shell environment, so export the same URL you
put in `apps/discord/.env`:

```bash
export DATABASE_URL=postgresql://user:password@localhost:5432/wildbeast
pnpm --filter @thesharks/drizzle migrate
```

Then build the workspace and start the development processes:

```bash
pnpm build
pnpm dev
```

For deployment and supervision, see
[Running in production](/self-hosting/running-in-production/). If you only
want a running bot and have Docker, its
[Docker Compose](/self-hosting/running-in-production/#docker-compose) section
starts the bot, PostgreSQL, and Redis with one command.

## Next steps

- [Configuration](/self-hosting/configuration/) covers every environment
  variable.
- [Upgrading from v8](/self-hosting/upgrading-from-v8/) explains what
  changed if you ran an earlier version.
- [Running in production](/self-hosting/running-in-production/) explains the
  process model, shutdown behavior, and supervision.
- [Redis](/self-hosting/redis/) explains what the bot stores there and how to
  operate it.
- [Clustering](/self-hosting/clustering/) explains how to scale across multiple
  processes and machines with autonomous shard rebalancing.
- [Telemetry](/self-hosting/telemetry/) shows how to wire up OpenTelemetry
  and Sentry.
- [Troubleshooting](/self-hosting/troubleshooting/) is the place to look when
  something misbehaves.
- [Development environment](/development/environment/) is the place to
  start for contributors.
