---
title: Troubleshooting
description: Symptoms, causes, and fixes for common WildBeast problems.
sidebar:
  order: 11
---

This page lists the common ways a WildBeast deployment fails, what each one
looks like in the logs, and how to fix it. The sections follow the order in
which problems tend to appear: the process exits, the cluster starts but
doesn't serve, shards misbehave, commands are missing, and background jobs
stall. When in doubt, raise the log level first: `NODE_ENV=development`
enables debug logging, and setting `TRACE` to any value raises it to trace.

## The process exits immediately

An immediate exit means startup failed before the cluster began serving. The
last log line names the stage that failed, and each stage has its own
message.

### `Invalid environment:` followed by field errors

The [configuration](/self-hosting/configuration/) failed validation before
anything started. The message names the exact variables. Typical causes are
a missing `DISCORD_TOKEN` or an out-of-range number.

### `Failed to start cluster:` with exit code 1

The cluster manager itself failed to start. The attached error is usually a
conflicting shard total proposal during a
[migration](/self-hosting/resharding/): two different new totals were
proposed at once, and the message names both.

### `WildBeast startup failed:` in a shard worker

The worker opened its resources in order and one of them failed. Everything
it opened before the failure is closed again. The line names the cause:

- `Database schema is out of date: run migrations` or `Entitlement mirror
  state missing: run migrations`. Apply the
  [migrations](/self-hosting/running-in-production/#database-migrations)
  and restart.
- Connection errors from `pg` or ioredis. Check `DATABASE_URL`, the
  `REDIS_*` variables, and that both services accept connections from the
  host.
- `TokenInvalid`. Discord rejected the token in `DISCORD_TOKEN`.

### `Fleet moved to epoch N (...); this cluster's configuration is stale, exiting.`

The fleet completed a shard total migration while this cluster was fenced
off or down. Update its `WILDBEAST_SHARDING_TOTAL` to the new total and
redeploy. The supervisor restart loop is expected in the meantime.

## The cluster starts but serves nothing

When the process stays up but no shards come online, the cluster is either
waiting on the rest of the fleet or has stepped back on purpose. The log
tells you which.

### `... parked as epoch N member until the old fleet drains.`

This isn't an error. The cluster is configured with a new shard total and is
waiting for the [rolling migration](/self-hosting/resharding/) to complete.
It starts serving the moment the last old-total cluster exits. If it stays
parked forever, some cluster is still running the old total. Find it via
the `discord_cluster_epoch` metric.

### `Cluster fleet disagrees on total shards.`

A cluster joined an existing epoch with a different
`WILDBEAST_SHARDING_TOTAL` than the fleet agreed on, without going through
a migration. Fix the total to match the fleet, or perform a real
[shard total change](/self-hosting/resharding/).

### `Coordination unreachable beyond the fencing deadline; stopping all shards.`

The cluster couldn't reach Redis for longer than the fencing deadline and
stopped its shards so another cluster can safely take them over. The
deadline is 15 seconds, which is three failed liveness ticks; that leaves
the 20-second worker-stop grace period inside the 45-second lease TTL.
`discord_cluster_fenced` reads 1 while this holds.

Recovery is automatic. Once Redis is reachable again the cluster logs
`Coordination recovered; resuming shard ownership` and re-acquires its
share. Investigate the Redis side, not the bot.

## Shards are slow or crash

Shard problems show up as slow readiness on cold starts, worker deaths, or
workers that don't stop cleanly. Only the second one usually needs your
attention.

### Shards take a long time to become ready

This is expected on cold starts. Identifies are rate-limited globally
through Redis at roughly 5.5 seconds per shard per rate-limit bucket, and
there is deliberately no spawn timeout. A 100-shard fleet identifying from
scratch takes minutes. Handoffs and restarts within 15 minutes resume
instead and skip the wait; see [Redis](/self-hosting/redis/) for how
sessions make that work.

### `Shard N died unexpectedly.`

The worker thread crashed. It's respawned automatically, by the manager in
static mode and by the reconciler in autonomous mode, and the crash is
reported to Sentry when configured. Look at the shard's logs right before
the death. Repeated deaths of the same shard usually point at a
guild-specific payload or memory pressure.

### `Shard N did not exit in time; terminating it` during shutdown

The worker didn't finish its graceful exit within the grace period and was
killed. This is harmless during shutdown. If it happens every time, the
shard is likely blocked on something during cleanup.

## Slash commands don't appear

Missing commands are almost always a registration or scoping issue rather
than a runtime failure. Check these causes in order:

- The bot needs the `applications.commands` OAuth scope. Reinvite it with
  the scope included; kicking it is not necessary.
- During development, commands register to a specific development guild
  (via `WILDBEAST_DEV_GUILD_ID`) rather than globally, so a self-hosted
  instance won't see them in other servers until you adjust or unset that
  variable.
- Globally registered commands can take up to an hour to propagate;
  guild-scoped ones appear immediately.
- `/flags` only exists in the guilds listed in `WILDBEAST_OPERATOR_GUILD_IDS`
  or the `operators.commandGuilds` runtime setting, and only server admins
  see it there. If it appears but answers `This command is reserved for the
  bot owner`, add your user id to `WILDBEAST_OWNER_IDS`.

## Background jobs don't run

Some jobs run only on the worker that owns shard 0, so a job that appears
stuck is usually waiting for the right worker or for fresh data. Both cases
log why.

### `Task deferred: <name> requires shard 0, which this worker does not own`

This debug-level line isn't an error. The entitlement snapshot, promoted
command repair, and operator command placement run only on the worker that
owns shard 0, and BullMQ handed the job to another worker first. The queue
retries the job until the owner picks it up; `discord_tasks_total` counts
these as `status="deferred"`. If a job stays deferred, no running cluster
owns shard 0.

### `Deferring over-cap demotion` in the promoted command repair

The entitlement mirror has no completed snapshot fresh enough to prove a
guild lost its subscription, so the repair kept its commands. It resolves
itself after the next successful snapshot, which
`discord_entitlement_reconcile_total` counts. If snapshots keep failing,
the log line before it names the API error.

## Where to look

When the logs alone don't explain a problem, these signals narrow it down.

| Signal | Where |
| --- | --- |
| Readiness per shard | `discord_manager_shard_up` gauge |
| Crash loops | `discord_manager_shard_launches_total` vs `_deaths_total` |
| Fleet state | `discord_cluster_epoch`, `discord_cluster_epoch_parked`, `discord_cluster_fenced` |
| Errors with stack traces | Sentry (when `SENTRY_DSN` is set) |
| Everything else | The [metrics reference](/self-hosting/metrics/) and [dashboards](/self-hosting/dashboards/) |

If you're stuck, ask in the [Discord server](https://discord.gg/wildbot)
with the log lines around the failure.

## Next steps

- [Configuration](/self-hosting/configuration/) lists every environment
  variable named on this page.
- [Running in production](/self-hosting/running-in-production/) covers
  migrations, supervision, and shutdown behavior.
- [Changing the shard total](/self-hosting/resharding/) explains epochs,
  parking, and fencing in full.
- [Redis](/self-hosting/redis/) describes the coordination keys behind the
  fleet messages above.
- The [metrics reference](/self-hosting/metrics/) defines the metrics used
  in the table above.
