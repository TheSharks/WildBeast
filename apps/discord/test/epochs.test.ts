import type { Redis } from 'ioredis'
import { describe, expect, it } from 'vitest'
import {
  awaitEpochActivation,
  EpochConflictError,
  EpochCoordinator,
} from '../src/sharding/epochs.mjs'

interface Entry {
  value: string
  expiresAt?: number
}

/** Minimal Redis model for proposal ownership/expiry. Promotion returns false
 * so tests can exercise refreshes while the old epoch remains occupied. */
class FakeEpochRedis {
  private readonly entries = new Map<string, Entry>()
  private now = 0

  public advance(milliseconds: number): void {
    this.now += milliseconds
  }

  public async get(key: string): Promise<string | null> {
    const entry = this.entries.get(key)
    if (entry?.expiresAt !== undefined && entry.expiresAt <= this.now) {
      this.entries.delete(key)
      return null
    }
    return entry?.value ?? null
  }

  public async set(
    key: string,
    value: string,
    ...args: Array<string | number>
  ): Promise<'OK' | null> {
    const nx = args.includes('NX')
    if (nx && (await this.get(key)) !== null) return null
    const pxIndex = args.indexOf('PX')
    const ttl = pxIndex === -1 ? undefined : Number(args[pxIndex + 1])
    this.entries.set(key, {
      value,
      ...(ttl === undefined ? {} : { expiresAt: this.now + ttl }),
    })
    return 'OK'
  }

  public async del(key: string): Promise<number> {
    return this.entries.delete(key) ? 1 : 0
  }

  public async eval(
    script: string,
    _numberOfKeys: number,
    key: string,
    expected: string,
    ttl?: string,
  ): Promise<number> {
    if (script.includes("redis.call('PTTL'")) {
      const entry = this.entries.get(key)
      if ((await this.get(key)) !== expected || !entry || entry.expiresAt) {
        return 0
      }
      entry.expiresAt = this.now + Number(ttl)
      return 1
    }
    if (script.includes("redis.call('PEXPIRE'")) {
      const entry = this.entries.get(key)
      if ((await this.get(key)) !== expected || !entry) return 0
      entry.expiresAt = this.now + Number(ttl)
      return 1
    }
    return 0
  }
}

function epochs(redis: FakeEpochRedis, totalShards: number) {
  return new EpochCoordinator(redis as never as Redis, {
    totalShards,
    pendingTtlMillis: 100,
  })
}

describe('EpochCoordinator pending proposal expiry', () => {
  it('keeps conflicting live proposals explicit', async () => {
    const redis = new FakeEpochRedis()
    await epochs(redis, 8).resolve()
    await epochs(redis, 16).resolve()

    await expect(epochs(redis, 32).resolve()).rejects.toThrow(
      /Conflicting shard total migrations/,
    )
  })

  it('lets a new total replace an abandoned proposal after its TTL', async () => {
    const redis = new FakeEpochRedis()
    await epochs(redis, 8).resolve()
    await epochs(redis, 16).resolve()

    redis.advance(101)
    await expect(epochs(redis, 32).resolve()).resolves.toEqual({
      state: { epoch: 2, totalShards: 32 },
      role: 'pending',
    })
  })

  it('puts a legacy no-TTL proposal on an expiry path', async () => {
    const redis = new FakeEpochRedis()
    await epochs(redis, 8).resolve()
    await redis.set(
      'wildbeast:epoch:pending',
      JSON.stringify({ epoch: 2, totalShards: 16 }),
      'NX',
    )

    await expect(epochs(redis, 32).resolve()).rejects.toThrow(
      /Conflicting shard total migrations/,
    )
    redis.advance(101)
    await expect(epochs(redis, 32).resolve()).resolves.toMatchObject({
      state: { totalShards: 32 },
      role: 'pending',
    })
  })

  it('refreshes a proposal while a parked cluster is driving it', async () => {
    const redis = new FakeEpochRedis()
    await epochs(redis, 8).resolve()
    const migrating = epochs(redis, 16)
    const { state: pending } = await migrating.resolve()

    redis.advance(75)
    expect(await migrating.tryPromote(pending)).toBe(false)
    redis.advance(75)
    await expect(epochs(redis, 32).resolve()).rejects.toThrow(
      /Conflicting shard total migrations/,
    )

    redis.advance(26)
    await expect(epochs(redis, 32).resolve()).resolves.toMatchObject({
      state: { totalShards: 32 },
      role: 'pending',
    })
  })

  it('does not let an expired proposer promote over its replacement', async () => {
    const redis = new FakeEpochRedis()
    await epochs(redis, 8).resolve()
    const old = epochs(redis, 16)
    const { state: oldPending } = await old.resolve()

    redis.advance(101)
    await epochs(redis, 32).resolve()

    await expect(old.tryPromote(oldPending)).rejects.toThrow(
      /replaced by one for 32/,
    )
    expect(await old.activeEpoch()).toEqual({ epoch: 1, totalShards: 8 })
  })

  it('re-claims an expired proposal that nothing replaced', async () => {
    const redis = new FakeEpochRedis()
    await epochs(redis, 8).resolve()
    const migrating = epochs(redis, 16)
    const { state: pending } = await migrating.resolve()

    // The proposal key expires with the whole pending fleet unable to reach
    // Redis; a later poll must restore it rather than go silent forever.
    redis.advance(101)
    expect(await redis.get('wildbeast:epoch:pending')).toBeNull()
    expect(await migrating.tryPromote(pending)).toBe(false)
    expect(await redis.get('wildbeast:epoch:pending')).toBe(
      JSON.stringify(pending),
    )

    // The restored proposal owns the slot again.
    await expect(epochs(redis, 32).resolve()).rejects.toThrow(
      /Conflicting shard total migrations/,
    )
  })

  it('surfaces a same-epoch promotion with a different total as a conflict', async () => {
    const redis = new FakeEpochRedis()
    await epochs(redis, 8).resolve()
    const old = epochs(redis, 16)
    const { state: pending } = await old.resolve()

    // The proposal expires, a 32-shard fleet replaces it and wins epoch 2.
    redis.advance(101)
    await epochs(redis, 32).resolve()
    await redis.set(
      'wildbeast:epoch',
      JSON.stringify({ epoch: 2, totalShards: 32 }),
    )
    await redis.del('wildbeast:epoch:pending')

    await expect(old.tryPromote(pending)).rejects.toThrow(
      /promoted with 32 shards/,
    )
  })

  it('propagates conflicts out of the activation wait instead of polling forever', async () => {
    const redis = new FakeEpochRedis()
    await epochs(redis, 8).resolve()
    const old = epochs(redis, 16)
    const { state: pending } = await old.resolve()

    redis.advance(101)
    await epochs(redis, 32).resolve()

    await expect(
      awaitEpochActivation({
        epochs: old,
        pending,
        heartbeat: async () => {},
        pollMillis: 5,
      }),
    ).rejects.toBeInstanceOf(EpochConflictError)
  })
})
