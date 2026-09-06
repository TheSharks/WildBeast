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
| `packages/tagscript` | A standalone templating interpreter, published as `@thesharks/tagscript`. Fully documented in its [README](https://github.com/TheSharks/WildBeast/tree/master/packages/tagscript). |
| `packages/drizzle` | The database client and schema ([Drizzle ORM](https://orm.drizzle.team/)). |
| `packages/test-utils` | Shared test helpers, see [Testing](/development/testing/). |
| `packages/tsconfig` | Shared TypeScript configuration. |

## Two kinds of process

A running cluster is a single Node.js process with two roles inside it: one
manager and one worker per shard.

**The cluster manager** (`src/cluster.mts`) is the entry point. It validates
the environment, sets up telemetry, and hands a discord.js `ShardingManager`
in **worker mode** to the `FleetManager` (`src/fleet/`): every shard is a
worker thread in this same process, not a child process. In autonomous mode
the fleet manager joins the fleet epoch and runs the
[sharding coordinator](/self-hosting/clustering/) that decides which shards
this cluster owns.

**Each shard worker** (`src/main.mts`) boots its own telemetry, builds its
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
| `integrations/` | Outbound HTTP clients for the fun and lookup commands. |
| `telemetry/` | Span helpers, runtime gauges, tag metrics, and the error reply. |

Alongside these sit `env.mts` (the validated environment), `sharding/`
(coordination, epochs, leases, session persistence, identify throttling, the
reconciler), `utils/` (Redis options, cron slugs), and `languages/`.

Pieces reach services through `this.container.app`, which the runtime
installs before the client logs in. Services never reach back into pieces,
read the container, or touch `process.env`.

## How work is admitted

Every command, component, event write, and task run enters the runtime's
`WorkScope` before it touches a service. That gives the process one place
to enforce its lifecycle guarantees.

- While the runtime is starting, work is rejected, so no command runs
  against a half-open database.
- While it's stopping, admission closes first. In-flight work drains within
  a deadline, then the task queue worker, gateway, session store, flags,
  Redis, database, and telemetry close in reverse order of opening.
- A drain that exceeds its deadline leaves storage open and exits with a
  non-zero code, so a supervisor never mistakes a hung worker for a clean
  exit.

Recurring work stays on Sapphire's scheduled-tasks plugin, so a repeat job
runs on exactly one worker fleet-wide. `AppScheduledTask` admits every run
through the work scope, gates it by its runtime flag, traces it, and checks
it in as a Sentry monitor. Cluster-dependent jobs declare `requiresShard`; a
worker that doesn't own that shard defers the job and BullMQ retries it
until the owner picks it up. The entitlement snapshot, the promoted-command
repair, and operator command placement require shard 0. Metrics collection
runs wherever the queue delivers it.

## How telemetry threads through

Telemetry initializes before anything else in both process roles
(`initOpenTelemetry` is the first real statement in `cluster.mts` and
`main.mts`), so auto-instrumentation hooks PostgreSQL, Redis, and outbound
HTTP from the first call. Commands and scheduled tasks run inside spans
because their base classes wrap them, and every listener that records a
metric pulls its meter from the same `@thesharks/analytics` package. The
[Telemetry](/self-hosting/telemetry/) page is the operator's view of the
same system.

## Next steps

- [Writing pieces](/development/pieces/) covers adding commands, listeners,
  and tasks.
- [Runtime flags and experiments](/development/features/) explains the
  shared gate and flag services.
- [Premium subscriptions](/development/premium/) explains tiers, limits,
  and the entitlement mirror.
