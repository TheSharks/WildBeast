---
title: Redis
description: What WildBeast stores in Redis and how to operate it.
sidebar:
  order: 4
---

WildBeast requires Redis as well as PostgreSQL. Redis stores task queues,
gateway sessions, and fleet coordination state. This page explains how that
data affects restarts, recovery, and sizing.

A single-cluster deployment uses Redis for three things: the scheduled task
queue, identify rate limiting, and persisted gateway sessions. In
[autonomous clustering](/self-hosting/clustering/), Redis additionally carries
all fleet coordination state. Every cluster in a fleet must point at the
same Redis; use `REDIS_DB` to give separate fleets separate database
indexes on a shared server.

Connect with `REDIS_URL` (a full `redis://`, `rediss://`, or `unix://`
URL) or with the `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` /
`REDIS_DB` parts. When `REDIS_URL` is set it takes precedence and the
parts are ignored; see [Configuration](/self-hosting/configuration/#redis)
for the full list.

## What's stored where

| Data | Keys | Lifetime |
| --- | --- | --- |
| Scheduled task queues | BullMQ's own `bull:scheduled-tasks-*` keys | One queue per shard assignment and epoch; retries stay with that assignment |
| Identify rate limiting | `wildbeast:identify:<bucket>` | Seconds (pacing keys) |
| Gateway sessions | `wildbeast:shard:<id>:session` | 15 minutes since last write |
| Active epoch | `wildbeast:epoch` | Until the next [migration](/self-hosting/resharding/) |
| Pending epoch proposal | `wildbeast:epoch:pending` | 45 seconds without refresh from a parked cluster |
| Fleet membership | `wildbeast:e<N>:clusters` | 15 seconds without a heartbeat |
| Shard total agreement | `wildbeast:e<N>:total_shards` | Life of the epoch |
| Shard leases | `wildbeast:e<N>:shard:<id>:owner` | 45 seconds without renewal |

In autonomous mode, coordination and session keys are scoped to the current
epoch (`wildbeast:e<N>:...`), so state from an old shard total can never
leak into a new one. The epoch pointer itself (`wildbeast:epoch`) is global.

A few details behind the table:

- Sessions hold the session id, sequence number, and resume URL of each
  shard's gateway connection. They let a shard moving to another cluster
  resume instead of re-identifying when Discord still accepts the session.
  Session records expire after 15 minutes without a write. A normal shutdown
  invalidates its sessions; a shard handoff preserves them for the new owner.
  Writes are debounced to once per second per shard. Failed writes stay dirty for the next interval, and session
  invalidations retry so a transient Redis error cannot leave a known-dead
  resume token behind for its full TTL.
- Membership is a sorted set scored by Redis server time, so clusters
  on hosts with skewed clocks still agree on who's alive.
- A lease records the owning cluster's ID. Another cluster cannot acquire
  that lease until it is released or expires. The
  [fencing deadline](/self-hosting/clustering/#the-safety-model) stops a
  cluster that loses Redis access before its leases expire.

## If Redis restarts or is flushed

Losing Redis data forces the fleet to rebuild its coordination state and
gateway sessions. PostgreSQL data, including tags and entitlements, remains
intact, but queued one-off jobs can be lost:

- Persisted sessions disappear, so every shard identifies fresh on its
  next reconnect instead of resuming. For a large fleet that means a slow,
  identify-rate-limited restart (roughly 5.5 seconds per shard per
  rate-limit bucket).
- Membership and leases re-form within seconds; running clusters
  heartbeat and re-acquire on their normal cadence. Heartbeat and renewal
  are independent of slow shard starts and stops.
- The task queue is recreated when clusters boot; recurring tasks resume
  their schedules. A one-shot job enqueued but not yet run is lost. The
  bot enqueues two of those on every boot, a full entitlement snapshot and
  operator command placement, and both are also covered by their recurring
  runs.
- The epoch pointer is re-initialized by the next cluster to resolve
  it. Don't flush Redis in the middle of a
  [shard total migration](/self-hosting/resharding/); the pending proposal
  would be lost.

We recommend enabling Redis persistence in production, such as an append-only
file with `appendfsync everysec`. This helps preserve sessions and queued jobs
across Redis restarts. Recovery still depends on which writes reached disk
and whether Discord accepts the saved sessions.

## Sizing

Redis stores a few coordination and session keys per shard, plus the task
queues. Monitor memory use as queue sizes grow. Keep Redis close to the
clusters to reduce latency for lease renewals and identify requests.

## Next steps

- [Configuration](/self-hosting/configuration/#redis) lists the `REDIS_*`
  variables.
- [Clustering](/self-hosting/clustering/) explains the coordination model these
  keys implement.
- [Troubleshooting](/self-hosting/troubleshooting/) covers the errors you see
  when Redis is unreachable or misconfigured.
