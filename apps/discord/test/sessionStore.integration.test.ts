import type { SessionInfo } from 'discord.js'
import { Redis } from 'ioredis'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { RedisSessionStore } from '../src/sharding/sessionStore.mjs'

// Runs only when REDIS_URL points at a disposable Redis, e.g.:
//   docker run --rm -p 16379:6379 redis:7-alpine
//   REDIS_URL=redis://localhost:16379 pnpm test
const redisUrl = process.env.REDIS_URL

describe.skipIf(!redisUrl)('RedisSessionStore (integration)', () => {
  const redis = redisUrl ? new Redis(redisUrl) : undefined

  beforeEach(async () => {
    await redis?.flushall()
  })

  afterAll(() => {
    redis?.disconnect()
  })

  function session(sequence: number): SessionInfo {
    return {
      sessionId: 'session-hash',
      sequence,
      shardId: 3,
      shardCount: 8,
      resumeURL: 'wss://gateway-us-east1-b.discord.gg',
    }
  }

  it('hands a session from a donor process to a successor', async () => {
    // Donor: continuous sequence updates, flushed on handoff exit.
    const donor = new RedisSessionStore(redis!, { flushIntervalMillis: 60_000 })
    for (let sequence = 1; sequence <= 1_000; sequence++) {
      donor.update(3, session(sequence))
    }
    await donor.close()

    // Successor: separate store instance, cold cache — as after a handoff.
    const successor = new RedisSessionStore(redis!)
    const recovered = await successor.retrieve(3)
    expect(recovered).toMatchObject({
      sessionId: 'session-hash',
      sequence: 1_000,
      shardCount: 8,
      resumeURL: 'wss://gateway-us-east1-b.discord.gg',
    })

    // Sessions must not live forever: a TTL protects against resuming
    // long-dead sessions.
    const ttl = await redis!.pttl('wildbeast:shard:3:session')
    expect(ttl).toBeGreaterThan(0)
    expect(ttl).toBeLessThanOrEqual(15 * 60_000)
  })

  it('propagates invalidation so a successor never resumes a dead session', async () => {
    const donor = new RedisSessionStore(redis!, { flushIntervalMillis: 60_000 })
    donor.update(3, session(50))
    await donor.flush()

    donor.update(3, null)
    // Nulls flush eagerly.
    await new Promise((resolveSleep) => setTimeout(resolveSleep, 50))
    await donor.close()

    const successor = new RedisSessionStore(redis!)
    expect(await successor.retrieve(3)).toBeNull()
  })
})
