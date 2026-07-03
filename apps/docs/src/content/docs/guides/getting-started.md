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
- A Discord bot token from the [Discord Developer Portal](https://discord.com/developers/applications)

## Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/TheSharks/WildBeast.git
cd WildBeast
pnpm install
```

## Running the bot

Build the workspace and start the Discord app:

```bash
pnpm build
pnpm dev
```

Create `apps/discord/.env` with at least your bot token (see
[Configuration](/guides/configuration/) for everything else):

```bash
DISCORD_TOKEN=your-bot-token
```

## Next steps

- [Configuration](/guides/configuration/) covers every environment
  variable.
- [Clustering](/scaling/clustering/) explains how to scale across multiple
  processes and machines with autonomous shard rebalancing.
- [Telemetry](/observability/telemetry/) shows how to wire up OpenTelemetry
  and Sentry.
- [Testing](/development/testing/) is the place to start for contributors.

The [GitHub repository](https://github.com/TheSharks/WildBeast) is the best
place to explore the codebase or ask questions.
