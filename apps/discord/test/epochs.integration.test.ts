import { silentLogger, waitUntil } from '@thesharks/test-utils'
import { Redis } from 'ioredis'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ClusterCoordinator } from '../src/sharding/coordination.mjs'
import {
  awaitEpochActivation,
  EpochCoordinator,
  epochKeyPrefix,
} from '../src/sharding/epochs.mjs'
import { ShardReconciler } from '../src/sharding/reconciler.mjs'
import { FakeHost } from './helpers.mjs'

// Runs only when REDIS_URL points at a disposable Redis, e.g.:
//   docker run --rm -p 16379:6379 redis:7-alpine
//   REDIS_URL=redis://localhost:16379 pnpm test
const redisUrl = process.env.REDIS_URL

const MEMBERSHIP_TTL = 1_000

describe.skipIf(!redisUrl)('EpochCoordinator (integration)', () => {
  let redis: Redis
  const connections: Redis[] = []

  function connect(): Redis {
    const connection = new Redis(redisUrl!)
    connections.push(connection)
    return connection
  }

  beforeEach(async () => {
    redis = connect()
    await redis.flushall()
  })

  afterEach(() => {
    for (const connection of connections) {
      connection.disconnect()
    }
    connections.length = 0
  })

  it('initializes epoch 1 and lets matching totals join as active', async () => {
    const epochs = new EpochCoordinator(redis, { totalShards: 8 })
    expect(await epochs.resolve()).toEqual({
      state: { epoch: 1, totalShards: 8 },
      role: 'active',
    })

    // A second cluster with the same total joins the same epoch.
    const peer = new EpochCoordinator(connect(), { totalShards: 8 })
    expect(await peer.resolve()).toMatchObject({ role: 'active' })
  })

  it('parks a different total as a pending next epoch', async () => {
    await new EpochCoordinator(redis, { totalShards: 8 }).resolve()

    const migrating = new EpochCoordinator(connect(), { totalShards: 16 })
    expect(await migrating.resolve()).toEqual({
      state: { epoch: 2, totalShards: 16 },
      role: 'pending',
    })
  })

  it('rejects a second, conflicting migration proposal', async () => {
    await new EpochCoordinator(redis, { totalShards: 8 }).resolve()
    await new EpochCoordinator(connect(), { totalShards: 16 }).resolve()

    const conflicting = new EpochCoordinator(connect(), { totalShards: 32 })
    await expect(conflicting.resolve()).rejects.toThrow(
      /Conflicting shard total migrations/,
    )
  })

  it('refuses promotion while the active epoch has live members', async () => {
    const epochs = new EpochCoordinator(redis, {
      totalShards: 8,
      membershipTtlMillis: MEMBERSHIP_TTL,
    })
    await epochs.resolve()
    const activeMembers = new ClusterCoordinator(redis, {
      clusterId: 'old-cluster',
      totalShards: 8,
      keyPrefix: epochKeyPrefix(1),
      membershipTtlMillis: MEMBERSHIP_TTL,
    })
    await activeMembers.heartbeat()

    const migrating = new EpochCoordinator(connect(), {
      totalShards: 16,
      membershipTtlMillis: MEMBERSHIP_TTL,
    })
    const { state: pending } = await migrating.resolve()

    expect(await migrating.tryPromote(pending)).toBe(false)

    // The old cluster withdraws (rolling deploy finished): promotion works
    // and is idempotent for other pending members.
    await activeMembers.withdraw()
    expect(await migrating.tryPromote(pending)).toBe(true)
    expect(await migrating.tryPromote(pending)).toBe(true)
    expect(await migrating.activeEpoch()).toEqual({
      epoch: 2,
      totalShards: 16,
    })
  })

  it(
    'migrates a serving fleet to a new shard total without overlap',
    { timeout: 20_000 },
    async () => {
      // Old fleet: one cluster with 8 shards, serving.
      const oldCoordinator = new ClusterCoordinator(connect(), {
        clusterId: 'old-cluster',
        totalShards: 8,
        keyPrefix: epochKeyPrefix(1),
        membershipTtlMillis: MEMBERSHIP_TTL,
      })
      const oldEpochs = new EpochCoordinator(connect(), {
        totalShards: 8,
        membershipTtlMillis: MEMBERSHIP_TTL,
      })
      expect((await oldEpochs.resolve()).role).toBe('active')

      const oldHost = new FakeHost()
      const oldReconciler = new ShardReconciler(
        oldCoordinator,
        oldHost,
        {
          clusterId: 'old-cluster',
          totalShards: 8,
          tickMillis: 100,
          settleMillis: 250,
        },
        silentLogger,
      )
      await oldReconciler.start()
      await waitUntil(() => oldHost.shards.size === 8)

      // New fleet arrives with 16 shards: parks as pending epoch 2.
      const newEpochs = new EpochCoordinator(connect(), {
        totalShards: 16,
        membershipTtlMillis: MEMBERSHIP_TTL,
      })
      const resolution = await newEpochs.resolve()
      expect(resolution.role).toBe('pending')

      const newCoordinator = new ClusterCoordinator(connect(), {
        clusterId: 'new-cluster',
        totalShards: 16,
        keyPrefix: epochKeyPrefix(2),
        membershipTtlMillis: MEMBERSHIP_TTL,
      })
      const parked = awaitEpochActivation({
        epochs: newEpochs,
        pending: resolution.state,
        heartbeat: () => newCoordinator.heartbeat(),
        pollMillis: 100,
      })

      // While the old fleet serves, the new one must stay parked.
      await new Promise((resolveSleep) => setTimeout(resolveSleep, 500))
      expect(await newEpochs.activeEpoch()).toEqual({
        epoch: 1,
        totalShards: 8,
      })

      // The old fleet drains (rolling deploy replaces it).
      await oldReconciler.shutdown()
      expect(oldHost.shards.size).toBe(0)

      // Promotion happens, and the new fleet takes over all 16 shards.
      expect(await parked).toBe(true)
      const newHost = new FakeHost()
      const newReconciler = new ShardReconciler(
        newCoordinator,
        newHost,
        {
          clusterId: 'new-cluster',
          totalShards: 16,
          tickMillis: 100,
          settleMillis: 250,
        },
        silentLogger,
      )
      await newReconciler.start()
      await waitUntil(() => newHost.shards.size === 16)

      await newReconciler.shutdown()
    },
  )

  it('stops waiting when aborted', async () => {
    await new EpochCoordinator(redis, { totalShards: 8 }).resolve()
    // Keep the active epoch occupied so the waiter can't promote instantly.
    const activeMembers = new ClusterCoordinator(redis, {
      clusterId: 'old-cluster',
      totalShards: 8,
      keyPrefix: epochKeyPrefix(1),
    })
    await activeMembers.heartbeat()

    const migrating = new EpochCoordinator(connect(), { totalShards: 16 })
    const { state: pending } = await migrating.resolve()

    const abort = new AbortController()
    const waiting = awaitEpochActivation({
      epochs: migrating,
      pending,
      heartbeat: async () => undefined,
      pollMillis: 50,
      signal: abort.signal,
    })
    abort.abort()
    expect(await waiting).toBe(false)
  })
})
