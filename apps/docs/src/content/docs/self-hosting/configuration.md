---
title: Configuration
description: Environment variables and how WildBeast validates them.
sidebar:
  order: 2
---

WildBeast is configured entirely through environment variables. On startup
the cluster manager loads `apps/discord/.env` (when present) with Node's
built-in env-file support and validates the result against a
[zod](https://zod.dev) schema, so misconfiguration fails at boot with a
readable error instead of surfacing deep inside discord.js or Redis.

Variables already present in the real environment take precedence over the
`.env` file, so containerized deployments can inject configuration without a
file at all.

## Core

The essentials: the token, database, and runtime mode.

| Variable | Required | Description |
| --- | --- | --- |
| `DISCORD_TOKEN` | yes | Bot token. The v8 name `BOT_TOKEN` is accepted as a legacy alias. |
| `DATABASE_URL` | yes | PostgreSQL connection URL. It is validated before the bot logs in. |
| `NODE_ENV` | no | `development` enables debug logging and hot module reload. |
| `TRACE` | no | Any value raises the log level to trace. |

## Commands

Where slash commands register and what `/invite` hands out.

| Variable | Required | Description |
| --- | --- | --- |
| `WILDBEAST_DEV_GUILD_ID` | no | When set, slash commands register in this guild instead of globally. Guild commands update instantly, so development environments want this; production leaves it unset. Boot refuses the combination with `NODE_ENV=production`, because bulk-overwrite registration would remove every global command. |
| `WILDBEAST_INVITE_OVERRIDE` | no | A URL for `/invite` to hand out instead of the generated OAuth link. |

## Premium

See [Premium subscriptions](/development/premium/) for how tiers and
limits work.

| Variable | Required | Description |
| --- | --- | --- |
| `WILDBEAST_PREMIUM_SKUS` | no | Comma-separated `skuId:tier` or `skuId:tier:scope` entries mapping the app's monetization SKUs to premium tiers, for example `1315790123456789:premium:guild`. The scope (`user` or `guild`) matches the kind of subscription the SKU is sold as. Unset means premium is off: everything runs at the free tier. |

## Runtime flags

See [Runtime flags and experiments](/development/features/) for the typed
registry, targeting context, command/task gates, and experiment behavior.

| Variable | Required | Description |
| --- | --- | --- |
| `WILDBEAST_OFREP_URL` | no | Base URL of an OFREP-compatible feature flag service. Unset means gates, experiments, and limits use their in-code defaults. |
| `WILDBEAST_OFREP_TOKEN` | no | Bearer token sent to the OFREP service, for providers that need authentication. |
| `WILDBEAST_OFREP_CACHE_TTL` | no | Seconds a flag evaluation is reused before asking the service again. Defaults to 30; `0` evaluates every time. Remote changes take up to this long to apply. |

## Redis

Redis backs the scheduled task queue and, in multi-cluster setups, all
coordination state (identify rate limiting, shard leases, persisted gateway
sessions).

| Variable | Default | Description |
| --- | --- | --- |
| `REDIS_HOST` | `localhost` | Redis host. |
| `REDIS_PORT` | `6379` | Redis port (1–65535). |
| `REDIS_PASSWORD` | — | Optional password. |
| `REDIS_DB` | — | Optional database index. |

## Sharding and clustering

See [Clustering](/self-hosting/clustering/) for what these mean in practice.

| Variable | Default | Description |
| --- | --- | --- |
| `WILDBEAST_CLUSTERING_MODE` | `static` | `static` or `autonomous`. |
| `WILDBEAST_CLUSTER_ID` | hostname | Stable identity of this cluster in the fleet. |
| `WILDBEAST_SHARDING_TOTAL` | auto | Total shard count, fleet-wide. Required in autonomous mode. |
| `WILDBEAST_SHARDING_START` | `0` | First shard of this cluster's range (static mode only). |
| `WILDBEAST_SHARDING_END` | total − 1 | Last shard of this cluster's range, inclusive (static mode only). |

## Telemetry

See [Telemetry](/self-hosting/telemetry/) for the full story.

| Variable | Description |
| --- | --- |
| `SENTRY_DSN` | Enables Sentry error reporting and tracing. |
| `SENTRY_PROFILE_SESSION_SAMPLE_RATE` | Continuous profiling session rate for shard workers, 0 to 1. Defaults to 1. |
| `SENTRY_SPOTLIGHT` | `true` streams events to a local Spotlight sidecar for development. |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | Enables OTLP export of traces, metrics and logs. |
| `OTEL_SERVICE_NAME` | Overrides the reported service name. |

## Validation behavior

A few rules apply across all variables:

- Empty values (`REDIS_PORT=`) are treated as absent, not as empty strings.
- Numeric variables are coerced and range-checked; `SENTRY_DSN` must be a
  URL; `WILDBEAST_CLUSTERING_MODE` must be one of its two values.
- Range semantics (for example `WILDBEAST_SHARDING_END` fitting inside the
  total) are validated separately with specific error messages.
