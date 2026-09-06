---
title: Running in production
description: The process model, lifecycle, and how to supervise WildBeast.
sidebar:
  order: 5
---

A production cluster is one Node.js process:

```bash
pnpm build
NODE_ENV=production node apps/discord/dist/cluster.mjs
```

`pnpm --filter @thesharks/discord start` runs the same entry point.
Configuration comes from the environment or `apps/discord/.env`, see
[Configuration](/self-hosting/configuration/).

## Database migrations

The bot never migrates on boot. Apply the schema explicitly before
starting or restarting the fleet:

```bash
pnpm --filter @thesharks/drizzle migrate
```

Every cluster must run against the same schema version, and in a fleet
clusters start, stop, and upgrade at different times: a boot-time migrate
would race across clusters and tie schema changes to process restarts.
Migrating once, up front, keeps the rollout order obvious (migrate, then
roll the clusters) and is safe to re-run; an already-migrated database is a
no-op. A worker checks for the current schema before it opens Redis or logs
in. Against an unmigrated database it logs
`Database schema is out of date: run migrations` and exits, so a missed
migration fails the rollout instead of the first command.

Prebuilt multi-arch images (amd64 and arm64) are published to GitHub
Container Registry:

```bash
docker pull ghcr.io/thesharks/wildbeast:latest
docker run --env-file apps/discord/.env ghcr.io/thesharks/wildbeast:latest
```

`latest` tracks the newest stable release. Pin a version tag (`9`, `9.0`,
or `9.0.0`) for controlled upgrades, or use `edge` for the latest master
build.

To build the image yourself instead, use the monorepo root as the build
context so pnpm can resolve and compile the local workspace packages:

```bash
docker build -f apps/discord/Dockerfile -t wildbeast .
docker run --env-file apps/discord/.env wildbeast
```

`NODE_ENV=production` sets the log level to info and lowers trace sampling
to production rates (see [Telemetry](/self-hosting/telemetry/)). Anything
else counts as development.

## Process model

The entry point is the cluster manager. It validates the environment,
resolves the cluster identity, and runs every shard as a **worker thread**
inside the same process: one pid per cluster, no child processes. Two
consequences worth knowing:

- Memory and CPU limits apply to the cluster as a whole, not per shard.
  Size containers for the sum of the shards they run.
- In telemetry, the manager reports as `@thesharks/discord-manager` and
  each shard worker as `@thesharks/discord` with its shard id as
  `service.instance.id`.

A reachable Redis is required even for a single cluster: it backs the
scheduled task queue, the identify rate limiter, and persisted gateway
sessions.

If you're upgrading an existing v8 deployment,
[Upgrading from v8](/self-hosting/upgrading-from-v8/) covers the dropped
settings and other differences.

## Startup

A worker opens its resources in a fixed order and treats any failure as
fatal for the whole boot. It validates the environment first, then opens
the database and checks the schema, connects to Redis, initializes the
feature flag provider (a failed provider is logged and skipped, never
fatal), prepares the session store, logs in to Discord, and finally starts
taking scheduled jobs. If any step fails, every resource opened so far is
closed in reverse order and the worker exits with code 1 and a
`WildBeast startup failed:` line naming the cause. Commands are not
accepted until every resource is open.

## Shutdown

`SIGTERM` and `SIGINT` both shut down gracefully. The manager relays the
signal to the shard workers as a message (signals don't reach worker
threads), and each worker runs the same ordered stop:

1. Stop accepting work. A command that arrives now gets an immediate
   "temporarily unavailable" reply instead of timing out, and a queued job
   is deferred to another worker.
2. Drain the commands, events, and jobs already admitted, for up to 10
   seconds.
3. Close the task queue worker, then the gateway connection, then flush
   persisted sessions, then close the flag provider, Redis, the database,
   and telemetry.

The manager waits up to 20 seconds before forcibly terminating stragglers.
Shards drain concurrently in both clustering modes, so that is one
fleet-wide window rather than 20 seconds per shard. Worker OpenTelemetry
flushes are bounded at 5 seconds, followed by Sentry's 2-second flush,
leaving the rest of the manager grace for gateway and session-store
cleanup. If draining exceeds its deadline, the worker leaves storage
untouched and exits with code 1 rather than closing a database under
running work.

In autonomous mode a graceful shutdown also releases the cluster's shard
leases and withdraws it from fleet membership, so the surviving clusters
pick up its shards within seconds instead of waiting for leases to expire.
Give the process at least 30 seconds before a hard kill (Kubernetes'
default `terminationGracePeriodSeconds` is fine).

## Supervision

Run the process under a supervisor (systemd, Kubernetes, Docker restart
policies) that restarts on non-zero exit. The manager exits `1` in two
cases, and both want a restart:

- It failed to start: invalid environment, unreachable Discord, or a
  genuinely conflicting live [epoch proposal](/self-hosting/resharding/).
- Its configuration went stale: the fleet migrated to a new epoch while
  this cluster was fenced off. It logs a fatal message and exits so it can
  come back with fresh state.

You don't need to supervise individual shards. A crashed shard worker is
respawned automatically (by the manager in static mode, by the
[reconciler](/self-hosting/clustering/) in autonomous mode), and each respawn is
counted in `discord_manager_shard_launches_total`.

## Knowing it's healthy

`discord_manager_shard_up` is the readiness signal: one gauge per shard,
`1` once the shard is ready. Alert when any shard reads 0, and in
autonomous mode alert on `discord_cluster_fenced == 1`. The
[metrics reference](/self-hosting/metrics/) lists everything else, and the
bundled [dashboards and alert rules](/self-hosting/dashboards/) encode
these starting points.
