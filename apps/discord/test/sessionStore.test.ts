import type { SessionInfo } from 'discord.js'
import { describe, expect, it } from 'vitest'
import {
  installSessionPersistence,
  RedisSessionStore,
  type SessionKV,
} from '../src/sharding/sessionStore.mjs'

class FakeKV implements SessionKV {
  public readonly data = new Map<string, { value: string; ttl: number }>()
  public writes = 0

  public async get(key: string): Promise<string | null> {
    return this.data.get(key)?.value ?? null
  }

  public async set(
    key: string,
    value: string,
    _px: 'PX',
    milliseconds: number,
  ): Promise<unknown> {
    this.writes += 1
    this.data.set(key, { value, ttl: milliseconds })
    return 'OK'
  }

  public async del(key: string): Promise<unknown> {
    this.data.delete(key)
    return 1
  }
}

function session(sequence: number): SessionInfo {
  return {
    sessionId: 'abc123',
    sequence,
    shardId: 0,
    shardCount: 2,
    resumeURL: 'wss://gateway-us-east1-b.discord.gg',
  }
}

describe('RedisSessionStore', () => {
  it('serves updates from the in-memory cache before flushing', async () => {
    const kv = new FakeKV()
    const store = new RedisSessionStore(kv, { flushIntervalMillis: 60_000 })

    store.update(0, session(5))
    store.update(0, session(6))

    expect(await store.retrieve(0)).toMatchObject({ sequence: 6 })
    // Nothing flushed yet: updates are debounced.
    expect(kv.writes).toBe(0)
  })

  it('flushes only the latest state per shard', async () => {
    const kv = new FakeKV()
    const store = new RedisSessionStore(kv, { flushIntervalMillis: 60_000 })

    for (let sequence = 1; sequence <= 100; sequence++) {
      store.update(0, session(sequence))
    }
    await store.close()

    expect(kv.writes).toBe(1)
    const raw = await kv.get('wildbeast:shard:0:session')
    expect(JSON.parse(raw!)).toMatchObject({ sequence: 100 })
    expect(kv.data.get('wildbeast:shard:0:session')!.ttl).toBe(15 * 60_000)
  })

  it('flushes the interval loop without an explicit close', async () => {
    const kv = new FakeKV()
    const store = new RedisSessionStore(kv, { flushIntervalMillis: 20 })

    store.update(0, session(7))
    await new Promise((resolveSleep) => setTimeout(resolveSleep, 80))

    expect(kv.writes).toBeGreaterThanOrEqual(1)
    await store.close()
  })

  it('deletes invalidated sessions immediately', async () => {
    const kv = new FakeKV()
    const store = new RedisSessionStore(kv, { flushIntervalMillis: 60_000 })

    store.update(0, session(1))
    await store.flush()
    expect(kv.data.size).toBe(1)

    store.update(0, null)
    // Nulls flush eagerly, not on the debounce interval.
    await new Promise((resolveSleep) => setTimeout(resolveSleep, 20))
    expect(kv.data.size).toBe(0)
    expect(await store.retrieve(0)).toBeNull()
    await store.close()
  })

  it('falls back to Redis when the cache is cold', async () => {
    const kv = new FakeKV()
    const donor = new RedisSessionStore(kv, { flushIntervalMillis: 60_000 })
    donor.update(0, session(42))
    await donor.close()

    const successor = new RedisSessionStore(kv)
    expect(await successor.retrieve(0)).toMatchObject({
      sessionId: 'abc123',
      sequence: 42,
    })
  })
})

describe('installSessionPersistence', () => {
  it('rewires the session hooks when discord.js assigns its internal manager', async () => {
    const kv = new FakeKV()
    const store = new RedisSessionStore(kv, { flushIntervalMillis: 60_000 })

    // discord.js's own per-shard in-memory copy, read directly by its
    // packet handlers (e.g. RESUMED).
    const djsShard: { sessionInfo: SessionInfo | null } = { sessionInfo: null }
    const fakeClient = {
      ws: { _ws: null, shards: new Map([[0, djsShard]]) },
    }
    installSessionPersistence(
      fakeClient as unknown as Parameters<typeof installSessionPersistence>[0],
      store,
    )

    // Simulate discord.js creating the @discordjs/ws manager during login.
    const manager = {
      options: {
        retrieveSessionInfo: () => null,
        updateSessionInfo: () => undefined,
      },
    }
    fakeClient.ws._ws = manager as never

    manager.options.updateSessionInfo(0 as never, session(9) as never)
    expect(await manager.options.retrieveSessionInfo(0 as never)).toMatchObject(
      {
        sequence: 9,
      },
    )
    expect(await store.retrieve(0)).toMatchObject({ sequence: 9 })
    // The in-memory mirror must track updates, or resumes crash discord.js.
    expect(djsShard.sessionInfo).toMatchObject({ sequence: 9 })

    // A boot-time retrieve (cold cache, session from Redis) must also
    // populate the mirror before the RESUMED handler can fire.
    djsShard.sessionInfo = null
    const successor = new RedisSessionStore(kv)
    installSessionPersistence(
      fakeClient as unknown as Parameters<typeof installSessionPersistence>[0],
      successor,
    )
    await store.flush()
    await (
      fakeClient.ws._ws as never as {
        options: { retrieveSessionInfo(shardId: number): unknown }
      }
    ).options.retrieveSessionInfo(0)
    expect(djsShard.sessionInfo).toMatchObject({ sequence: 9 })
    await store.close()
  })

  it('throws loudly when the discord.js internals changed', () => {
    const store = new RedisSessionStore(new FakeKV())
    expect(() =>
      installSessionPersistence(
        { ws: {} } as unknown as Parameters<
          typeof installSessionPersistence
        >[0],
        store,
      ),
    ).toThrow(/internals changed/)
  })
})
