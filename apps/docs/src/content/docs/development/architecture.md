---
title: Architecture
description: How the codebase is laid out and how a running cluster fits together.
sidebar:
  order: 1
---

WildBeast is a pnpm workspace managed with [Turborepo](https://turborepo.dev/).
The bot itself is one app; the reusable parts are split into packages so they
can be tested, and in some cases published, on their own.

| Path | What it is |
| --- | --- |
| `apps/discord` | The bot: the cluster manager, shard workers, and all the pieces (commands, listeners, tasks). |
| `apps/docs` | This documentation site ([Starlight](https://starlight.astro.build/)). |
| `packages/analytics` | The telemetry layer: OpenTelemetry bootstrap, the Sapphire logger bridge, metric helpers. Has its own [README](https://github.com/TheSharks/WildBeast/tree/master/packages/analytics). |
| `packages/tagscript` | A standalone templating interpreter, published as `@thesharks/tagscript`. Fully documented in its [README](https://github.com/TheSharks/WildBeast/tree/master/packages/tagscript). |
| `packages/drizzle` | The database client and schema ([Drizzle ORM](https://orm.drizzle.team/)). |
| `packages/test-utils` | Shared test helpers, see [Testing](/development/testing/). |
| `packages/tsconfig` | Shared TypeScript configuration. |

## Two kinds of process

A running cluster is a single Node.js process with two roles inside it.

**The cluster manager** (`src/cluster.mts`) is the entry point. It validates
the environment, sets up telemetry, and runs a discord.js `ShardingManager`
in **worker mode**: every shard is a worker thread in this same process, not
a child process. In autonomous mode the manager also runs the
[sharding coordinator](/self-hosting/clustering/) that decides which shards this
cluster owns.

**Each shard worker** (`src/index.mts`) boots its own telemetry, then imports
`src/structures/client.mts` to construct the Sapphire client and log in. This
is where the pieces live and where commands actually run.

The manager and workers share one environment, so configuration resolved once
in the manager (the cluster id, the epoch) is passed to workers through
`process.env`. Signals only reach the main thread, so the manager relays
lifecycle commands (shutdown, handoff) to workers as messages. See
[Running in production](/self-hosting/running-in-production/) for the lifecycle in
full.

## Where the bot's code lives

Everything under `apps/discord/src` outside `structures/` and `utils/` is
either a Sapphire piece or its supporting data:

| Directory | Contents |
| --- | --- |
| `commands/` | Application commands. Loaded recursively, so subdirectories (`slash/`) are just organization. |
| `listeners/` | Event listeners, grouped by purpose (`metrics/`, `logging/`, `reporting/`). |
| `scheduled-tasks/` | Recurring background jobs, backed by a BullMQ queue on Redis. |
| `languages/` | i18next translation files, one directory per locale. |
| `features/` | Typed runtime flags, OFREP evaluation, command/task gates, and experiment telemetry. |
| `premium/` | Subscription tiers, entitlement resolution, SKU mapping, and typed limits. |
| `preconditions/` | Reusable Sapphire policy checks, including premium and runtime feature gates. |
| `structures/` | The `client`, and the `TracedCommand` / `TracedScheduledTask` base classes. |
| `sharding/` | The autonomous clustering machinery: coordination, leases, epochs, session persistence. |
| `utils/` | Cross-cutting helpers: the tracing wrappers, Redis connection options, cron slug derivation. |

Pieces are discovered by Sapphire from these directories at load time; there
is no central registry to edit. [Writing pieces](/development/pieces/) covers
how to add one.

## How telemetry threads through

Telemetry is not bolted on at the edges; it is initialized before anything
else in both process roles (`initOpenTelemetry` is the first real statement in
`cluster.mts` and `index.mts`) so auto-instrumentation can hook Postgres,
Redis, and outbound HTTP from the first call. Commands and scheduled tasks run
inside spans because their base classes wrap them, and every listener that
records a metric pulls its meter from the same `@thesharks/analytics` package.
The [Telemetry](/self-hosting/telemetry/) page is the operator's view of the
same system.
