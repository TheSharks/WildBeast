---
title: Redis
description: What WildBeast stores in Redis and how to operate it.
sidebar:
  order: 4
---

Redis is WildBeast's only required external service. This page covers what
lives in it, which keys to expect, and what happens when that data is lost,
so you can make an informed call about persistence and sizing.

A single-cluster deployment uses Redis for three things: the scheduled task
queue, identify rate limiting, and persisted gateway sessions. In
[autonomous clustering](/scaling/clustering/), Redis additionally carries
all fleet coordination state. Every cluster in a fleet must point at the
same Redis; use `REDIS_DB` to give separate fleets separate database
indexes on a shared server.

## What's stored where

| Data | Keys | Lifetime |
| --- | --- | --- |
| Scheduled task queue | BullMQ's own `bull:*` keys | Recreated on boot |
| Identify rate limiting | `wildbeast:identify:<bucket>` | Seconds (pacing keys) |
| Gateway sessions | `wildbeast:shard:<id>:session` | 15 minutes since last write |
| Active epoch | `wildbeast:epoch`, `wildbeast:epoch:pending` | Until the next [migration](/scaling/resharding/) |
| Fleet membership | `wildbeast:e<N>:clusters` | 15 seconds without a heartbeat |
| Shard total agreement | `wildbeast:e<N>:total_shards` | Life of the epoch |
| Shard leases | `wildbeast:e<N>:shard:<id>:owner` | 30 seconds without renewal |

In autonomous mode, coordination and session keys are scoped to the current
epoch (`wildbeast:e<N>:...`), so state from an old shard total can never
leak into a new one. The epoch pointer itself (`wildbeast:epoch`) is global.

A few details behind the table:

- **Sessions** hold the session id, sequence number, and resume URL of each
  shard's gateway connection. They let a shard moving to another cluster
  resume instead of re-identifying, and they're what makes restarts cheap:
  a shard that comes back within 15 minutes replays missed events rather
  than starting a fresh session. Writes are debounced to once per second
  per shard.
- **Membership** is a sorted set scored by Redis server time, so clusters
  on hosts with skewed clocks still agree on who's alive.
- **Leases** guarantee a shard never has two owners: the value is the
  owning cluster's id, and another cluster's acquire fails until the lease
  is released or expires.

## If Redis restarts or is flushed

Nothing in Redis is precious; all of it can be rebuilt. The cost of losing
it is connection churn, not data loss:

- Persisted **sessions** disappear, so every shard identifies fresh on its
  next reconnect instead of resuming. For a large fleet that means a slow,
  identify-rate-limited restart (roughly 5.5 seconds per shard per
  rate-limit bucket).
- **Membership and leases** re-form within seconds; running clusters
  heartbeat and re-acquire on their normal cadence.
- The **task queue** is recreated when clusters boot; recurring tasks
  resume their schedules. A one-shot job enqueued but not yet run is lost.
- The **epoch pointer** is re-initialized by the next cluster to resolve
  it. Don't flush Redis in the middle of a
  [shard total migration](/scaling/resharding/); the pending proposal
  would be lost.

We recommend enabling Redis persistence (AOF with `everysec` is plenty) in
production. It isn't required for correctness, but it turns a Redis restart
into a non-event instead of a fleet-wide re-identify.

## Sizing

The footprint is small: a handful of keys per shard plus the task queue.
Even large fleets use megabytes, not gigabytes. Latency matters more than
memory; keep Redis close to the clusters, since leases and identify pacing
sit on the hot path of shard lifecycle operations.

## Next steps

- [Configuration](/guides/configuration/#redis) lists the `REDIS_*`
  variables.
- [Clustering](/scaling/clustering/) explains the coordination model these
  keys implement.
- [Troubleshooting](/guides/troubleshooting/) covers the errors you see
  when Redis is unreachable or misconfigured.
