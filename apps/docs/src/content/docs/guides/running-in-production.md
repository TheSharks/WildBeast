---
title: Running in production
description: The process model, lifecycle, and how to supervise WildBeast.
sidebar:
  order: 3
---

A production cluster is one Node.js process:

```bash
pnpm build
NODE_ENV=production node apps/discord/dist/cluster.mjs
```

`pnpm --filter @thesharks/discord start` runs the same entry point.
Configuration comes from the environment or `apps/discord/.env`, see
[Configuration](/guides/configuration/).

`NODE_ENV=production` sets the log level to info, disables hot module
reload, and lowers trace sampling to production rates (see
[Telemetry](/observability/telemetry/)). Anything else counts as
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

## Shutdown

`SIGTERM` and `SIGINT` both shut down gracefully. The manager relays the
signal to the shard workers as a message (signals don't reach worker
threads), each worker closes its gateway connection and flushes telemetry,
and the manager waits before forcibly terminating stragglers, 10 seconds
per shard in autonomous mode, 15 seconds overall in static mode. Pending
telemetry is flushed with a 10-second deadline, then the process exits 0.

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
  conflicting [epoch proposal](/scaling/resharding/).
- Its configuration went stale: the fleet migrated to a new epoch while
  this cluster was fenced off. It logs a fatal message and exits so it can
  come back with fresh state.

You don't need to supervise individual shards. A crashed shard worker is
respawned automatically (by the manager in static mode, by the
[reconciler](/scaling/clustering/) in autonomous mode), and each respawn is
counted in `discord_manager_shard_launches_total`.

## Knowing it's healthy

`discord_manager_shard_up` is the readiness signal: one gauge per shard,
`1` once the shard is ready. Alert when any shard reads 0, and in
autonomous mode alert on `discord_cluster_fenced == 1`. The
[metrics reference](/observability/metrics/) lists everything else, and the
bundled [dashboards and alert rules](/observability/dashboards/) encode
these starting points.
