import { Redis } from 'ioredis'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { RedisIdentifyThrottler } from '../src/sharding/identifyThrottler.mjs'

// Runs only when REDIS_URL points at a disposable Redis, e.g.:
//   docker run --rm -p 16379:6379 redis:7-alpine
//   REDIS_URL=redis://localhost:16379 pnpm test
const redisUrl = process.env.REDIS_URL

const WINDOW = 500

describe.skipIf(!redisUrl)('RedisIdentifyThrottler (integration)', () => {
  // Two connections simulate two clusters sharing one identify budget.
  const clusterA = redisUrl ? new Redis(redisUrl) : undefined
  const clusterB = redisUrl ? new Redis(redisUrl) : undefined

  beforeEach(async () => {
    await clusterA?.flushall()
  })

  afterAll(() => {
    clusterA?.disconnect()
    clusterB?.disconnect()
  })

  it('serializes identifies in the same bucket across connections', async () => {
    const a = new RedisIdentifyThrottler(clusterA!, 1, WINDOW)
    const b = new RedisIdentifyThrottler(clusterB!, 1, WINDOW)

    const startedAt = Date.now()
    const elapsed = await Promise.all([
      a
        .waitForIdentify(0, new AbortController().signal)
        .then(() => Date.now() - startedAt),
      b
        .waitForIdentify(1, new AbortController().signal)
        .then(() => Date.now() - startedAt),
    ])
    elapsed.sort((x, y) => x - y)

    expect(elapsed[0]).toBeLessThan(200)
    expect(elapsed[1]).toBeGreaterThanOrEqual(WINDOW)
  })

  it('lets different buckets identify concurrently across connections', async () => {
    const a = new RedisIdentifyThrottler(clusterA!, 2, WINDOW)
    const b = new RedisIdentifyThrottler(clusterB!, 2, WINDOW)

    const startedAt = Date.now()
    await Promise.all([
      a.waitForIdentify(0, new AbortController().signal),
      b.waitForIdentify(1, new AbortController().signal),
    ])

    expect(Date.now() - startedAt).toBeLessThan(200)
  })

  it('holds the lock for the identify window without releasing it', async () => {
    const a = new RedisIdentifyThrottler(clusterA!, 1, WINDOW)
    await a.waitForIdentify(3, new AbortController().signal)

    expect(await clusterA!.get('wildbeast:identify:0')).toBe('3')
    const ttl = await clusterA!.pttl('wildbeast:identify:0')
    expect(ttl).toBeGreaterThan(0)
    expect(ttl).toBeLessThanOrEqual(WINDOW)
  })

  it('rejects an aborted waiter without disturbing the holder', async () => {
    const a = new RedisIdentifyThrottler(clusterA!, 1, WINDOW)
    await a.waitForIdentify(0, new AbortController().signal)

    const controller = new AbortController()
    const waiting = a.waitForIdentify(1, controller.signal)
    setTimeout(() => controller.abort(), 50)

    await expect(waiting).rejects.toThrow()
    expect(await clusterA!.get('wildbeast:identify:0')).toBe('0')
  })
})
