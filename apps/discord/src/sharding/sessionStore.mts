import type { Client, SessionInfo } from 'discord.js'

// Minimal Redis surface for testability.
export interface SessionKV {
  get(key: string): Promise<string | null>
  set(
    key: string,
    value: string,
    millisecondsToken: 'PX',
    milliseconds: number,
  ): Promise<unknown>
  del(key: string): Promise<unknown>
}

export interface SessionStoreOptions {
  keyPrefix?: string
  /** Dirty-session flush cadence. Default 1s. */
  flushIntervalMillis?: number
  /** Persisted session lifetime. Default 15m. */
  sessionTtlMillis?: number
  onError?: (error: unknown) => void
}

// Persists gateway sessions so handed-off shards RESUME instead of re-identifying.
// In-memory cache is authoritative locally; Redis is the handoff medium. Flush via close() before exit.
export class RedisSessionStore {
  private readonly cache = new Map<number, SessionInfo | null>()
  // Dirty revision per shard; writes clear only the revision observed so racing updates stay dirty.
  private readonly dirty = new Map<number, number>()
  private readonly prefix: string
  private readonly flushIntervalMillis: number
  private readonly sessionTtlMillis: number
  private readonly onError: (error: unknown) => void
  private revision = 0
  private flushWork?: Promise<void>
  private timer?: NodeJS.Timeout

  public constructor(
    private readonly redis: SessionKV,
    options: SessionStoreOptions = {},
  ) {
    this.prefix = options.keyPrefix ?? 'wildbeast'
    this.flushIntervalMillis = options.flushIntervalMillis ?? 1_000
    this.sessionTtlMillis = options.sessionTtlMillis ?? 15 * 60_000
    this.onError =
      options.onError ?? ((error) => console.error('Session store:', error))
  }

  private key(shardId: number): string {
    return `${this.prefix}:shard:${shardId}:session`
  }

  public async retrieve(shardId: number): Promise<SessionInfo | null> {
    // Warm cache wins (newer than Redis between flushes) on this hot path.
    if (this.cache.has(shardId)) {
      return this.cache.get(shardId) ?? null
    }

    let raw: string | null
    try {
      raw = await this.redis.get(this.key(shardId))
    } catch (error) {
      // Fail open as "no session" so a Redis outage never crashes connect; keep cache clean for retry.
      this.onError(error)
      return null
    }
    let session: SessionInfo | null = null
    if (raw) {
      try {
        session = JSON.parse(raw) as SessionInfo
      } catch (error) {
        // Corrupt session reads as "no session" (fresh identify), never a crash.
        this.onError(error)
        try {
          await this.redis.del(this.key(shardId))
        } catch {
          // Corrupt key ages out via TTL.
        }
      }
    }
    this.cache.set(shardId, session)
    return session
  }

  public update(shardId: number, session: SessionInfo | null): void {
    this.cache.set(shardId, session)
    this.dirty.set(shardId, ++this.revision)

    // Null updates need retries too: a failed delete would hand the next owner an invalidated session.
    this.ensureFlushTimer()

    if (session === null) {
      // Flush invalidations eagerly; a stale session dooms the next owner's resume.
      void this.flush().catch(this.onError)
      return
    }
  }

  private ensureFlushTimer(): void {
    if (!this.timer) {
      this.timer = setInterval(() => {
        void this.flush().catch(this.onError)
      }, this.flushIntervalMillis)
      // Never keep an exiting worker alive.
      this.timer.unref()
    }
  }

  public async flush(): Promise<void> {
    // Concurrent callers join the active pass then re-check; updates racing the snapshot stay dirty.
    while (this.dirty.size > 0) {
      const work = this.flushWork ?? this.flushPass()
      this.flushWork = work
      try {
        await work
      } finally {
        if (this.flushWork === work) this.flushWork = undefined
      }
    }
  }

  private async flushPass(): Promise<void> {
    const pending = [...this.dirty]
    let firstError: unknown

    for (const [shardId, revision] of pending) {
      const session = this.cache.get(shardId)
      try {
        if (session == null) {
          await this.redis.del(this.key(shardId))
        } else {
          await this.redis.set(
            this.key(shardId),
            JSON.stringify(session),
            'PX',
            this.sessionTtlMillis,
          )
        }
        if (this.dirty.get(shardId) === revision) {
          this.dirty.delete(shardId)
        }
      } catch (error) {
        // Stay dirty and continue so one bad key starves no other shard.
        firstError ??= error
      }
    }

    if (firstError !== undefined) throw firstError
  }

  public async close(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = undefined
    }
    try {
      await this.flush()
    } catch (error) {
      // Shutdown must not throw; unpersisted sessions just identify fresh.
      this.onError(error)
    }
  }
}

interface SessionHookHost {
  options: {
    retrieveSessionInfo(shardId: number): unknown
    updateSessionInfo(shardId: number, session: SessionInfo | null): unknown
  }
}

// discord.js hardcodes session hooks in-memory, so intercept the internal manager to redirect them.
export function installSessionPersistence(
  client: Client,
  store: RedisSessionStore,
): void {
  if (!('_ws' in client.ws)) {
    throw new Error(
      'discord.js internals changed: WebSocketManager#_ws is gone, session persistence needs updating',
    )
  }

  const ws = client.ws as unknown as { _ws: SessionHookHost | null }
  let backing = ws._ws

  // Mirror discord.js's per-shard in-memory copy or resumes crash reading sessionInfo.
  const mirror = (shardId: number, session: SessionInfo | null) => {
    // Mirrors discord.js's own assignment in WebSocketManager#connect.
    const shard = client.ws.shards.get(shardId) as unknown as
      | { sessionInfo: SessionInfo | null }
      | undefined
    if (shard) {
      shard.sessionInfo = session
    }
  }

  const wire = (manager: SessionHookHost | null) => {
    if (!manager) return
    manager.options.retrieveSessionInfo = async (shardId) => {
      const session = await store.retrieve(shardId)
      mirror(shardId, session)
      return session
    }
    manager.options.updateSessionInfo = (shardId, session) => {
      store.update(shardId, session)
      mirror(shardId, session)
    }
  }

  wire(backing)
  Object.defineProperty(client.ws, '_ws', {
    configurable: true,
    get: () => backing,
    set: (value: SessionHookHost | null) => {
      backing = value
      wire(value)
    },
  })
}
