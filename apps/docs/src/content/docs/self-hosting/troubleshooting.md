---
title: Troubleshooting
description: Symptoms, causes, and fixes for common WildBeast problems.
sidebar:
  order: 11
---

Common failure modes, what they look like in the logs, and how to fix them.
When in doubt, raise the log level first: `NODE_ENV=development` enables
debug logging, and setting `TRACE` to any value raises it to trace.

## The process exits immediately

**`Invalid environment:` followed by field errors.** The
[configuration](/self-hosting/configuration/) failed validation before anything
started. The message names the exact variables; typical causes are a
missing `DISCORD_TOKEN` or an out-of-range number.

**`Failed to start cluster:` and exit code 1.** Startup itself failed. The
attached error tells you which of the usual suspects it was:

- An invalid token (Discord rejects the connection).
- Redis unreachable (connection errors from ioredis). Check `REDIS_HOST`
  and `REDIS_PORT`, and that Redis accepts connections from the host.
- A conflicting shard total proposal during a
  [migration](/self-hosting/resharding/): two different new totals were proposed
  at once. The message names both totals.

**`Fleet moved to epoch N (...); this cluster's configuration is stale,
exiting.`** The fleet completed a shard total migration while this cluster
was fenced off or down. Update its `WILDBEAST_SHARDING_TOTAL` to the new
total and redeploy; the supervisor restart loop is expected in the
meantime.

## The cluster starts but serves nothing

**`... parked as epoch N member until the old fleet drains.`** Not an
error: this cluster is configured with a new shard total and is waiting for
the [rolling migration](/self-hosting/resharding/) to complete. It starts
serving the moment the last old-total cluster exits. If it stays parked
forever, some cluster is still running the old total; find it via the
`discord_cluster_epoch` metric.

**`Cluster fleet disagrees on total shards.`** A cluster joined an existing
epoch with a different `WILDBEAST_SHARDING_TOTAL` than the fleet agreed on,
without going through a migration. Fix the total to match the fleet, or
perform a real [shard total change](/self-hosting/resharding/).

**`Coordination unreachable beyond the fencing deadline; stopping all
shards.`** The cluster couldn't reach Redis for longer than the fencing
deadline (15 seconds — three failed liveness ticks, leaving the 20-second
worker-stop grace inside the 45-second lease TTL) and stopped its shards so
another cluster can safely take them over. `discord_cluster_fenced` reads 1 while this holds. Recovery is
automatic: once Redis is reachable it logs
`Coordination recovered; resuming shard ownership` and re-acquires its
share. Investigate the Redis side, not the bot.

## Shards

**Shards take a long time to become ready.** Expected on cold starts:
identifies are rate-limited globally through Redis at roughly 5.5 seconds
per shard per rate-limit bucket, and there is deliberately no spawn
timeout. A 100-shard fleet identifying from scratch takes minutes. Handoffs
and restarts within 15 minutes resume instead and skip the wait; see
[Redis](/self-hosting/redis/) for how sessions make that work.

**`Shard N died unexpectedly.`** The worker thread crashed. It's respawned
automatically (by the manager in static mode, by the reconciler in
autonomous mode) and the crash is reported to Sentry when configured. Look
at the shard's logs right before the death; repeated deaths of the same
shard usually point at a guild-specific payload or memory pressure.

**`Shard N did not exit in time; terminating it` during shutdown.** The
worker didn't finish its graceful exit within the grace period and was
killed. Harmless during shutdown; if it happens every time, the shard is
likely blocked on something during cleanup.

## Slash commands don't appear

- The bot needs the `applications.commands` OAuth scope. Reinvite it with
  the scope included; kicking it is not necessary.
- During development, commands register to a specific development guild
  (the `guildIds` option in the command class) rather than globally, so a
  self-hosted instance won't see them in other servers until you adjust or
  remove those ids.
- Globally registered commands can take up to an hour to propagate;
  guild-scoped ones appear immediately.

## Where to look

| Signal | Where |
| --- | --- |
| Readiness per shard | `discord_manager_shard_up` gauge |
| Crash loops | `discord_manager_shard_launches_total` vs `_deaths_total` |
| Fleet state | `discord_cluster_epoch`, `discord_cluster_epoch_parked`, `discord_cluster_fenced` |
| Errors with stack traces | Sentry (when `SENTRY_DSN` is set) |
| Everything else | The [metrics reference](/self-hosting/metrics/) and [dashboards](/self-hosting/dashboards/) |

If you're stuck, ask in the [Discord server](https://discord.gg/8wjT9Av)
with the log lines around the failure.
