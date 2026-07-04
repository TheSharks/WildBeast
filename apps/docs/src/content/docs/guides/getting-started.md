---
title: Getting started
description: How to set up and run WildBeast.
sidebar:
  order: 1
---

WildBeast is a modular Discord bot developed by The Sharks.

## Prerequisites

- [Node.js](https://nodejs.org/) 22 or later
- [pnpm](https://pnpm.io/)
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

Create `apps/discord/.env` with at least your bot token (see
[Configuration](/guides/configuration/) for everything else):

```bash
DISCORD_TOKEN=your-bot-token
```

Then build the workspace and start the Discord app in watch mode:

```bash
pnpm build
pnpm dev
```

For a real deployment, see
[Running in production](/guides/running-in-production/).

## Next steps

- [Configuration](/guides/configuration/) covers every environment
  variable.
- [Running in production](/guides/running-in-production/) explains the
  process model, shutdown behavior, and supervision.
- [Redis](/guides/redis/) explains what the bot stores there and how to
  operate it.
- [Clustering](/scaling/clustering/) explains how to scale across multiple
  processes and machines with autonomous shard rebalancing.
- [Telemetry](/observability/telemetry/) shows how to wire up OpenTelemetry
  and Sentry.
- [Troubleshooting](/guides/troubleshooting/) is the place to look when
  something misbehaves.
- [Development environment](/development/environment/) is the place to
  start for contributors.

The [GitHub repository](https://github.com/TheSharks/WildBeast) is the best
place to explore the codebase or ask questions.
