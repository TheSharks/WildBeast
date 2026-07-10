---
title: Clustering
description: Running WildBeast across multiple autonomous clusters.
sidebar:
  order: 1
---

WildBeast can run as a fleet of independent **clusters** (one process per
machine, container, or replica) that discover each other through a shared
Redis and split the bot's shards among themselves. Clusters rebalance
automatically as members join, leave, or crash, so you can restart or scale
one machine without touching the rest.

Every cluster runs the same code with the same configuration except for its
`WILDBEAST_CLUSTER_ID`. There is no leader and no controller process.

## Modes

The clustering mode decides how shards are assigned: fixed ranges you
manage yourself, or automatic assignment negotiated through Redis.

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

```bash
WILDBEAST_CLUSTERING_MODE=autonomous
WILDBEAST_SHARDING_TOTAL=8
WILDBEAST_CLUSTER_ID=cluster-1   # stable per replica
```

Clusters sharing a Redis form a fleet. Each one heartbeats a membership
entry, computes its share of the shards with [rendezvous
hashing](https://en.wikipedia.org/wiki/Rendezvous_hashing), and reconciles
toward it, acquiring a lease per shard before serving it and releasing
leases for shards it hands off. The assignment is a pure function of the
live member list, so every cluster computes the same answer without any
negotiation.

Heartbeat and lease renewal run independently from shard lifecycle work. A
worker can spend its full drain grace stopping, or wait in the global identify
queue while starting, without starving the timers that keep its membership and
already-acquired leases alive.

When a cluster joins, shards that hash to it are handed over by their
current owners after a 10-second settle window. When one leaves gracefully
(SIGTERM), it releases its leases and withdraws, and survivors pick its
shards up within seconds. When one crashes, its membership entry (15s TTL)
and leases (30s TTL) expire and survivors take over within about a minute.

:::tip[Stable identities matter]
Use a stable `WILDBEAST_CLUSTER_ID` (a StatefulSet ordinal, a machine name).
A restarted cluster with the same id hashes to exactly the shards it had
before, so rolling deploys cause minimal movement.
:::

## Why handoffs are cheap

Two fleet-wide coordination mechanisms make shard movement nearly free:

The first is a global identify queue. Discord allows one gateway identify
per 5 seconds per rate-limit bucket, per bot token, across *all* processes.
Every identify in the fleet is serialized through a Redis lock, so clusters
can never trip each other into invalid sessions, no matter how many start
at once.

The second is session resume. Each shard's gateway session (id, sequence,
resume URL) is continuously persisted to Redis. When a shard moves between
clusters, the old owner exits *without closing the gateway connection*, and
the new owner resumes the session: no identify consumed, and Discord
replays the events missed during the gap. A takeover typically completes in
about one second with zero event loss. If a session turns out to be
unusable (expired, corrupt, wrong shard total), the shard falls back to a
fresh identify through the queue automatically.

## The safety model

Correctness never depends on the assignment math alone:

Leases are the ground truth: a shard is only served while its Redis lease
is held, and a new owner's acquisition fails until the previous owner
releases or expires. Two live sessions for one shard cannot happen.

Settle windows prevent churn. Membership must be stable for 10 seconds
before shards move, so a flapping cluster or a rolling deploy doesn't cause
a reshuffle storm.

A cluster that cannot reach Redis for 5 seconds fences itself and stops
serving its shards, before its leases can expire and another cluster picks
them up.

Losing one lease fences that shard immediately: its local worker is stopped
before reconciliation may try to acquire it again. Multi-shard drains happen
concurrently, but each lease stays held until its corresponding worker is dead.

Finally, a fleet-wide guard protects the shard total. Guild-to-shard
routing is `(guild_id >> 22) % total`, so all clusters must agree on
`WILDBEAST_SHARDING_TOTAL`. A mismatched cluster refuses to serve; see
[Changing the shard total](/scaling/resharding/) for how totals are
migrated safely.

## Operating notes

- All clusters must share the same Redis (`REDIS_*` variables).
- Shard readiness, ownership, handoffs and fleet membership are all exported
  as metrics, see the [metrics reference](/observability/metrics/). The
  `discord_manager_shard_up` gauge is the one to alert on.
- Identify pacing means a cold fleet start takes roughly 5.5 seconds per
  shard per rate-limit bucket. Resumed handoffs skip this entirely.
