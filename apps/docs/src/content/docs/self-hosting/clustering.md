---
title: Clustering
description: Sharding terminology and how to distribute WildBeast across clusters.
sidebar:
  order: 6
---

WildBeast runs each shard in a worker thread and groups those workers into
clusters. You can keep everything in one process or spread the workload
across machines as your bot grows.

## Sharding terminology

The distinction to keep in mind is worker, cluster, and fleet: a thread, a
process, and the whole deployment. Here's how those fit together:

| Term | Meaning in WildBeast |
| --- | --- |
| Shard worker | The Node.js worker thread that connects a shard to Discord and handles its commands, events, and scheduled tasks. |
| Cluster | One WildBeast Node.js process containing a cluster manager and the shard workers assigned to it. You can run clusters on the same machine or on separate machines or containers. |
| Cluster manager | The main thread of a cluster process. It starts and stops that cluster's shard workers and, in autonomous mode, coordinates their ownership through Redis. |
| Fleet | All the clusters running the same bot together. A deployment with one cluster is a fleet of one. |
| Shard total | The number of shards across the whole fleet. This is `WILDBEAST_SHARDING_TOTAL`, not the number of clusters or the number of shards assigned to one cluster. |

For example, a fleet with eight shards and two clusters might assign shards
`0` through `3` to `cluster-1` and shards `4` through `7` to `cluster-2`.
Each cluster runs four shard workers.

Adding a third cluster gives the fleet another process to run those same
eight shards. Increasing the shard total changes how guilds map to shards
and requires a [shard total migration](/self-hosting/resharding/).

## Modes

The clustering mode decides how shards are assigned: fixed ranges you
manage yourself, or automatic assignment calculated from shared Redis state.

### Static (default)

Each cluster serves a fixed shard range:

```bash
# Cluster 1
WILDBEAST_SHARDING_START=0 WILDBEAST_SHARDING_END=3 WILDBEAST_SHARDING_TOTAL=8

# Cluster 2
WILDBEAST_SHARDING_START=4 WILDBEAST_SHARDING_END=7 WILDBEAST_SHARDING_TOTAL=8
```

With no sharding variables set, a single cluster runs every shard Discord
recommends. Scaling means editing ranges and redeploying.

### Autonomous

Clusters discover each other through Redis and redistribute shards as
clusters join, leave, or crash. Run the same code and fleet configuration on
each cluster, with a different `WILDBEAST_CLUSTER_ID` for each one. Every
cluster manager participates; there is no central leader.

```bash
WILDBEAST_CLUSTERING_MODE=autonomous
WILDBEAST_CLUSTER_ID=cluster-1   # stable per replica
```

Each cluster periodically updates its membership record in Redis, called a
heartbeat. It uses [rendezvous hashing](https://en.wikipedia.org/wiki/Rendezvous_hashing)
to calculate its shard assignment from the live member list. Every cluster
calculates the same assignment. Its reconciler then starts or stops local
workers to match that assignment.

You can leave `WILDBEAST_SHARDING_TOTAL` unset. A new fleet uses Discord's
recommended shard count and stores it in Redis. Simultaneous starters adopt
whichever total is stored first. Later clusters use the stored total without
fetching another recommendation, so changes to Discord's recommendation don't
trigger a migration. If a migration is pending, new automatically sized clusters
join it and wait for the old fleet to drain.

Set `WILDBEAST_SHARDING_TOTAL` explicitly to choose a total or start a
[shard total migration](/self-hosting/resharding/). Adding or removing clusters
doesn't change the total or create a new epoch.

Heartbeat and lease renewal run independently from shard lifecycle work. A
worker can spend its full drain grace stopping, or wait in the global identify
queue while starting, without starving the timers that keep its membership and
already-acquired leases alive.

When a cluster joins, shards that hash to it are handed over by their
current owners after a 10-second settle window. When one leaves gracefully
(SIGTERM), it releases its leases and withdraws, and survivors pick its
shards up within seconds. When one crashes, its membership entry (15s TTL)
and leases (45s TTL) expire and survivors take over within about a minute.

:::tip[Stable identities matter]
Use a stable `WILDBEAST_CLUSTER_ID` (a StatefulSet ordinal, a machine name).
A restarted cluster with the same id hashes to exactly the shards it had
before, so rolling deploys cause minimal movement.
:::

## Why handoffs are cheap

Shard handoffs use a shared identify queue and saved gateway sessions to
reduce reconnect delays.

The first is a global identify queue. Discord allows one gateway identify
per 5 seconds per rate-limit bucket, per bot token, across *all* processes.
A Redis lock coordinates identifies within each rate-limit bucket so
clusters sharing Redis follow the same pacing.

The second is session resume. Each shard's gateway session (id, sequence,
resume URL) is continuously persisted to Redis. When a shard moves between
clusters, the old owner closes the gateway with a resumable close code and
flushes its saved session before releasing ownership. If Discord accepts the
session, the new owner resumes without an identify and receives replayed
events. An expired, corrupt, or incompatible session requires a fresh
identify through the queue.

## The safety model

Correctness never depends on the assignment math alone:

Leases are the ground truth: a shard is only served while its Redis lease is
held, and a new owner's acquisition fails until the previous owner releases or
expires. The fencing deadline stops a cluster that loses Redis access before its
leases expire.

Settle windows prevent churn. Membership must be stable for 10 seconds
before shards move, so a flapping cluster or a rolling deploy doesn't cause
a reshuffle storm.

A cluster that cannot reach Redis for 15 seconds fences itself and stops serving
its shards, before its leases can expire and another cluster picks them up. A
single failed coordination round trip is not enough to fence: the deadline spans
three 5-second liveness ticks, allowing a brief Redis interruption to recover
before fencing.

Losing one lease fences that shard immediately: its local worker is stopped
before reconciliation may try to acquire it again. Multi-shard drains happen
concurrently, but each lease stays held until its corresponding worker is dead.

Finally, a fleet-wide guard protects the shard total. Guild-to-shard
routing is `(guild_id >> 22) % total`, so all serving clusters use the same
stored epoch total. A cluster with a different explicit override parks; see
[Changing the shard total](/self-hosting/resharding/) for how totals are
migrated safely.

## Operating notes

- All clusters must share the same Redis (`REDIS_*` variables).
- Shard readiness, ownership, handoffs, and fleet membership are all exported
  as metrics, see the [metrics reference](/self-hosting/metrics/). The
  `discord_manager_shard_up` gauge is the one to alert on.
- Identify pacing means a cold fleet start takes roughly 5.5 seconds per
  shard per rate-limit bucket. Resumed handoffs skip this entirely.
