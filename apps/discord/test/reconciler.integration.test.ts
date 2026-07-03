import { silentLogger, waitUntil } from '@thesharks/test-utils'
import { Redis } from 'ioredis'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { shardsFor } from '../src/sharding/assignment.mjs'
import { ClusterCoordinator } from '../src/sharding/coordination.mjs'
import { ShardReconciler } from '../src/sharding/reconciler.mjs'
import { FakeHost } from './helpers.mjs'

// Runs only when REDIS_URL points at a disposable Redis, e.g.:
//   docker run --rm -p 16379:6379 redis:7-alpine
//   REDIS_URL=redis://localhost:16379 pnpm test
const redisUrl = process.env.REDIS_URL

const TOTAL = 16
const TIMINGS = {
  membershipTtlMillis: 1_000,
  leaseTtlMillis: 1_500,
  tickMillis: 100,
  settleMillis: 250,
  fenceAfterMillis: 800,
}

interface TestCluster {
  id: string
  redis: Redis
  host: FakeHost
  reconciler: ShardReconciler
}

describe.skipIf(!redisUrl)('ShardReconciler (integration)', () => {
  const clusters: TestCluster[] = []
  let cleanupRedis: Redis

  function createCluster(id: string): TestCluster {
    const redis = new Redis(redisUrl!)
    const host = new FakeHost()
    const reconciler = new ShardReconciler(
      new ClusterCoordinator(redis, {
        clusterId: id,
        totalShards: TOTAL,
        membershipTtlMillis: TIMINGS.membershipTtlMillis,
        leaseTtlMillis: TIMINGS.leaseTtlMillis,
      }),
      host,
      {
        clusterId: id,
        totalShards: TOTAL,
        tickMillis: TIMINGS.tickMillis,
        settleMillis: TIMINGS.settleMillis,
        fenceAfterMillis: TIMINGS.fenceAfterMillis,
      },
      silentLogger,
    )
    const cluster = { id, redis, host, reconciler }
    clusters.push(cluster)
    return cluster
  }

  function noOverlap(a: FakeHost, b: FakeHost): boolean {
    return [...a.shards].every((shardId) => !b.shards.has(shardId))
  }

  beforeEach(async () => {
    cleanupRedis = new Redis(redisUrl!)
    await cleanupRedis.flushall()
  })

  afterEach(async () => {
    for (const cluster of clusters) {
      await cluster.reconciler.halt()
      cluster.redis.disconnect()
    }
    clusters.length = 0
    cleanupRedis.disconnect()
  })

  it('runs the full lifecycle: solo ownership, join rebalance, graceful leave', {
    timeout: 20_000,
  }, async () => {
    const a = createCluster('cluster-a')
    await a.reconciler.start()

    // Alone in the fleet, cluster-a should own every shard.
    await waitUntil(() => a.host.shards.size === TOTAL)

    // A second cluster joins: shards must split along the rendezvous
    // assignment, and at no point may both clusters run the same shard.
    const b = createCluster('cluster-b')
    await b.reconciler.start()

    const members = ['cluster-a', 'cluster-b']
    const expectA = new Set(shardsFor('cluster-a', members, TOTAL))
    const expectB = new Set(shardsFor('cluster-b', members, TOTAL))
    expect(expectB.size).toBeGreaterThan(0)

    await waitUntil(() => {
      expect(noOverlap(a.host, b.host)).toBe(true)
      return (
        a.host.shards.size === expectA.size &&
        b.host.shards.size === expectB.size &&
        [...expectB].every((shardId) => b.host.shards.has(shardId))
      )
    })

    // Every running shard's lease must be held by the cluster running it.
    for (const shardId of b.host.shards) {
      expect(await cleanupRedis.get(`wildbeast:shard:${shardId}:owner`)).toBe(
        'cluster-b',
      )
    }

    // Graceful leave: cluster-b releases its leases and withdraws, so
    // cluster-a should reclaim everything without waiting for expiry.
    const reclaimStart = Date.now()
    await b.reconciler.shutdown()
    await waitUntil(() => a.host.shards.size === TOTAL)
    // Well under the lease TTL, proving the release path (not expiry).
    expect(Date.now() - reclaimStart).toBeLessThan(TIMINGS.leaseTtlMillis)
  })

  it('recovers shards from a crashed cluster after its leases expire', {
    timeout: 20_000,
  }, async () => {
    const a = createCluster('cluster-a')
    const b = createCluster('cluster-b')
    await a.reconciler.start()
    await b.reconciler.start()

    await waitUntil(
      () =>
        a.host.shards.size + b.host.shards.size === TOTAL &&
        noOverlap(a.host, b.host) &&
        b.host.shards.size > 0,
    )

    // Crash: no release, no withdrawal — membership and leases just
    // stop being renewed.
    await b.reconciler.halt()

    await waitUntil(() => a.host.shards.size === TOTAL)
  })

  it('refuses to start when the fleet disagrees on the shard total', async () => {
    const a = createCluster('cluster-a')
    await a.reconciler.start()

    const redis = new Redis(redisUrl!)
    const mismatched = new ShardReconciler(
      new ClusterCoordinator(redis, {
        clusterId: 'cluster-x',
        totalShards: TOTAL * 2,
      }),
      new FakeHost(),
      { clusterId: 'cluster-x', totalShards: TOTAL * 2 },
      silentLogger,
    )

    await expect(mismatched.start()).rejects.toThrow(
      /disagrees on total shards/,
    )
    redis.disconnect()
  })
})
