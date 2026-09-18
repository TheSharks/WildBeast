---
title: Architecture
description: How the codebase is laid out and how a running cluster fits together.
sidebar:
  order: 1
---

WildBeast is a pnpm workspace managed with [Turborepo](https://turborepo.dev/).
The bot itself is one app; the reusable parts are split into packages so you
can test them, and in some cases publish them, on their own.

| Path | What it is |
| --- | --- |
| `apps/discord` | The bot: the cluster manager, shard workers, and all the pieces (commands, listeners, tasks). |
| `apps/docs` | This documentation site ([Starlight](https://starlight.astro.build/)). |
| `packages/analytics` | The telemetry layer: OpenTelemetry bootstrap, the Sapphire logger bridge, metric helpers. Has its own [README](https://github.com/TheSharks/WildBeast/tree/master/packages/analytics). |
| `packages/tui` | The terminal dashboard the cluster manager shows in an interactive terminal, see [Terminal dashboard](/self-hosting/telemetry/#terminal-dashboard). Has its own [README](https://github.com/TheSharks/WildBeast/tree/master/packages/tui). |
| `packages/tagscript` | A standalone templating interpreter, published as `@thesharks/tagscript`. Fully documented in its [README](https://github.com/TheSharks/WildBeast/tree/master/packages/tagscript). |
| `packages/drizzle` | The database client and schema ([Drizzle ORM](https://orm.drizzle.team/)). |
| `packages/test-utils` | Shared test helpers, see [Testing](/development/testing/). |
| `packages/tsconfig` | Shared TypeScript configuration. |

## Cluster manager and shard workers

A running cluster is a single Node.js process with two roles inside it: one
manager and one worker per shard. All clusters serving the same bot form its
fleet. See [Sharding terminology](/self-hosting/clustering/#sharding-terminology)
for how workers, clusters, and the fleet fit together.

The cluster manager, `src/cluster.mts`, is the entry point. It validates the
environment, sets up telemetry, and passes a discord.js `ShardingManager` in
worker mode to `FleetManager` in `src/fleet/`. Each shard runs in a worker
thread within the cluster process. In autonomous mode, the fleet manager
joins the fleet epoch and runs the
[sharding coordinator](/self-hosting/clustering/) that decides which shards
this cluster owns.

Each shard worker, `src/main.mts`, initializes its own telemetry, builds its
configuration once (`AppConfig`), and composes the application
(`composeApplication`). The database, Redis, feature flags, the session
store, the Sapphire client, and the task queue open in that order and close
in reverse. Pieces run only while the runtime accepts work; a stopping
worker answers new interactions with a temporary-unavailability reply
instead of letting them expire.

The manager and workers share one environment, so configuration resolved
once in the manager (the cluster id, the epoch) reaches workers through
`process.env`. Signals only reach the main thread, so the manager relays
lifecycle commands (shutdown, handoff) to workers as messages. See
[Running in production](/self-hosting/running-in-production/) for the
lifecycle in full.

## Where the bot's code lives

The application lives under `apps/discord/src`, split by responsibility.
Sapphire pieces own Discord input, localization, and replies. Feature
services own authorization, limits, and workflows, and receive their
dependencies at construction. Adapters own PostgreSQL, Redis, and Discord
REST. The runtime owns configuration, resource lifecycle, and admission of
work.

| Directory | Contents |
| --- | --- |
| `commands/` | Application commands, extending `AppCommand` or `AppSubcommand` (admitted, traced, gated). |
| `listeners/` | Event listeners, grouped by purpose (`metrics/`, `reporting/`, `premium/`, `tags/`, `registration/`, `logging/`, `lifecycle/`). |
| `interaction-handlers/` | Component handlers; command-backed ones extend `GatedCommandInteractionHandler`. |
| `scheduled-tasks/` | Recurring jobs on the Sapphire scheduled-tasks plugin (BullMQ on Redis), extending `AppScheduledTask`. |
| `preconditions/` | The runtime feature gate, premium, and owner-only checks. |
| `structures/` | The command, interaction-handler, and scheduled-task base classes. |
| `runtime/` | `AppConfig`, `ApplicationRuntime` (ordered startup and teardown), `WorkScope` (admission and draining), the Sapphire client factory, and `composeApplication`. |
| `fleet/` | The cluster manager: shard worker lifecycle, epochs, leases, and resumable handoffs. |
| `features/` | The typed flag registry, the `FeatureFlags` service, `CommandGates`, `Experiments`, and the `/flags` inspector. |
| `premium/` | The grant model, `PremiumService` (interaction and background decisions), snapshot synchronization, limits, and upsells. |
| `tags/` | `TagService` (guild-scoped workflows), durable promotion intents, and `TagReconciler`. |
| `operators/` | Placement of operator commands into the configured guilds. |
| `adapters/` | PostgreSQL repositories and Discord gateways behind the service interfaces. |
| `integrations/` | Code a command shares with its component handlers, one file per command: reply builders, custom ids, and API clients. |
| `telemetry/` | The shared `meter`, span helpers, runtime gauges, tag metrics, the error reply, and the worker-to-manager metric feed for the terminal dashboard. |

Alongside these sit `env.mts` (the validated environment), `sharding/`
(coordination, epochs, leases, session persistence, identify throttling, the
reconciler), `utils/` (Redis options, cron slugs, HTTP fetch helpers, shared replies), and
`languages/`.

Pieces reach services through `this.container.app`, which the runtime
installs before the client logs in. Services never reach back into pieces,
read the container, or touch `process.env`.

### Where new code goes

Put new code in the directory that already holds its kind, and add a
directory only for a new domain:

- A piece goes in the directory Sapphire loads it from, such as `commands/`
  or `interaction-handlers/`. Those directories hold nothing but pieces.
- Code that a command shares with its component handlers goes in a single
  file in `integrations/`: the message builder, the custom id constants, and
  the API client when the command calls a service. `integrations/urban.mts`
  serves `/urbandictionary` and its pagination buttons, and
  `integrations/fun-messages.mts` serves `/cat`, `/dog`, and `/inspire`
  together. The command cookbook's
  [Add a button](/development/command-cookbook/#add-a-button) recipe walks
  through it.
- A top-level directory belongs to a domain with its own service, such as
  `tags/` or `premium/`. Name it for the domain, and don't add a directory
  for a single command.
- Keep code that other modules import out of piece files. Sapphire loads
  each piece file through a cache-busting URL, so a static import of a piece
  file evaluates it a second time and leaves two copies of the module.

## How work is admitted

Commands, gated component handlers, event writes, and task runs enter the
runtime's `WorkScope` before using services. The work scope tracks these
operations so startup and shutdown can control when they run.

- While the runtime is starting, work is rejected, so no command runs
  against a half-open database.
- While it's stopping, admission closes first. In-flight work drains within
  a deadline, then the task queue worker, gateway, session store, flags,
  Redis, database, and telemetry close in reverse order of opening.
- A drain that exceeds its deadline leaves storage open and exits with a
  non-zero code, so a supervisor never mistakes a hung worker for a clean
  exit.

Recurring work uses Sapphire's scheduled-tasks plugin with a separate BullMQ
queue for each shard worker. `AppScheduledTask` admits every run
through the work scope, gates it by its runtime flag, traces it, and checks
it in as a Sentry monitor. Cluster-dependent jobs declare `requiresShard`;
only that shard's worker registers their schedule. The entitlement snapshot,
the promoted-command
repair, and operator command placement require shard 0. Metrics collection
runs on every worker. Queue names include a hash of the bot identity, shard
assignment, and epoch or static shard total, so restarts reuse the same queue
without sharing jobs with unrelated workers. Retries stay on that queue.

## Telemetry initialization

The cluster manager and each shard worker call `initOpenTelemetry` before
opening application resources. This lets auto-instrumentation record PostgreSQL,
Redis, and outbound HTTP calls from startup onward.

Both entry points (`cluster.mts` and `main.mts`) also load the application
with `await import()` after that call, not with a static import. A metric
instrument created before the meter provider is registered never records, and
static imports run before an entry point's own code. `telemetryOrder.test.ts`
fails when an entry point statically imports a module that creates
instruments. The environment and `AppConfig` load first, so the modules they
import, such as `sharding/keys.mts`, must stay free of instruments.

Commands and scheduled tasks
run inside spans because their base classes wrap them, and every module that
records a metric creates its instruments from the one `meter` in
`telemetry/meter.mjs`.
The [Telemetry](/self-hosting/telemetry/) page is the operator's view of the
same system.

## Next steps

- [Writing pieces](/development/pieces/) covers adding commands, listeners,
  and tasks.
- The [command cookbook](/development/command-cookbook/) has step-by-step
  recipes for new commands.
- [Runtime flags and experiments](/development/features/) explains the
  shared gate and flag services.
- [Premium subscriptions](/development/premium/) explains tiers, limits,
  and the entitlement mirror.
