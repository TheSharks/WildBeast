import { describe, expect, it } from 'vitest'
import {
  type IdentifyLockStore,
  RedisIdentifyThrottler,
} from '../src/sharding/identifyThrottler.mjs'

class FakeLockStore implements IdentifyLockStore {
  private readonly locks = new Map<
    string,
    { value: string; expiresAt: number }
  >()

  public async set(
    key: string,
    value: string,
    _px: 'PX',
    milliseconds: number,
    _nx: 'NX',
  ): Promise<'OK' | null> {
    const existing = this.locks.get(key)
    if (existing && existing.expiresAt > Date.now()) {
      return null
    }
    this.locks.set(key, { value, expiresAt: Date.now() + milliseconds })
    return 'OK'
  }

  public async pttl(key: string): Promise<number> {
    const existing = this.locks.get(key)
    if (!existing) {
      return -2
    }
    const remaining = existing.expiresAt - Date.now()
    return remaining > 0 ? remaining : -2
  }

  public holder(key: string): string | undefined {
    const existing = this.locks.get(key)
    if (!existing || existing.expiresAt <= Date.now()) {
      return undefined
    }
    return existing.value
  }
}

const WINDOW = 80

describe('RedisIdentifyThrottler', () => {
  it('lets shards in different buckets identify concurrently', async () => {
    const store = new FakeLockStore()
    const throttler = new RedisIdentifyThrottler(store, 2, WINDOW)

    const started = Date.now()
    await Promise.all([
      throttler.waitForIdentify(0, new AbortController().signal),
      throttler.waitForIdentify(1, new AbortController().signal),
    ])

    expect(Date.now() - started).toBeLessThan(WINDOW)
    expect(store.holder('wildbeast:identify:0')).toBe('0')
    expect(store.holder('wildbeast:identify:1')).toBe('1')
  })

  it('serializes shards in the same bucket by the identify window', async () => {
    const store = new FakeLockStore()
    const throttler = new RedisIdentifyThrottler(store, 1, WINDOW)

    const started = Date.now()
    await throttler.waitForIdentify(0, new AbortController().signal)
    expect(Date.now() - started).toBeLessThan(WINDOW)

    await throttler.waitForIdentify(1, new AbortController().signal)
    // The second identify must have waited out the first one's window.
    expect(Date.now() - started).toBeGreaterThanOrEqual(WINDOW)
  })

  it('applies the max_concurrency modulo for bucket assignment', async () => {
    const store = new FakeLockStore()
    const throttler = new RedisIdentifyThrottler(store, 4, WINDOW)

    await throttler.waitForIdentify(6, new AbortController().signal)
    expect(store.holder('wildbeast:identify:2')).toBe('6')
  })

  it('rejects when aborted before acquiring', async () => {
    const store = new FakeLockStore()
    const throttler = new RedisIdentifyThrottler(store, 1, WINDOW)

    // Occupy the bucket, then abort a queued waiter.
    await throttler.waitForIdentify(0, new AbortController().signal)

    const controller = new AbortController()
    const waiting = throttler.waitForIdentify(1, controller.signal)
    controller.abort()

    await expect(waiting).rejects.toThrow()
  })

  it('rejects immediately when the signal is already aborted', async () => {
    const store = new FakeLockStore()
    const throttler = new RedisIdentifyThrottler(store, 1, WINDOW)

    await expect(
      throttler.waitForIdentify(0, AbortSignal.abort()),
    ).rejects.toThrow()
    expect(store.holder('wildbeast:identify:0')).toBeUndefined()
  })
})
