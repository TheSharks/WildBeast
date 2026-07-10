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

The production image must be built with the monorepo root as its context so
pnpm can resolve and compile the local workspace packages:

```bash
docker build -f apps/discord/Dockerfile -t wildbeast .
docker run --env-file apps/discord/.env wildbeast
```

`NODE_ENV=production` sets the log level to info, disables hot module
reload, and lowers trace sampling to production rates (see
[Telemetry](/self-hosting/telemetry/)). Anything else counts as
development.

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

WildBeast v9 no longer posts guild counts to third-party bot-listing sites.
The v8 `TOP_GG_TOKEN`, `BOTS_GG_TOKEN`, `DBL_COM_TOKEN`,
`ONDISCORD_XYZ_TOKEN`, and `DEL_XYZ_TOKEN` settings are intentionally ignored;
remove them or run a separate listing-statistics publisher if those listings
still need periodic updates.

## Shutdown

`SIGTERM` and `SIGINT` both shut down gracefully. The manager relays the
signal to the shard workers as a message (signals don't reach worker
threads), each worker closes its gateway connection and flushes telemetry,
and the manager waits up to 20 seconds before forcibly terminating
stragglers. Shards drain concurrently in both clustering modes, so that is
one fleet-wide window rather than 20 seconds per shard. Worker OpenTelemetry
flushes are bounded at 5 seconds, followed by Sentry's 2-second flush, leaving
the rest of the manager grace for gateway and session-store cleanup.

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
