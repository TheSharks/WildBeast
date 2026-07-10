import type { Client, SessionInfo } from 'discord.js'

/**
 * The subset of Redis commands the store needs; keeps it testable without a
 * Redis server.
 */
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
  /** How often dirty sessions are written to Redis. Default 1s. */
  flushIntervalMillis?: number
  /** How long a persisted session stays retrievable. Default 15 minutes. */
  sessionTtlMillis?: number
  onError?: (error: unknown) => void
}

/**
 * Persists gateway sessions (session id, sequence, resume URL) in Redis so a
 * shard moving to another cluster can RESUME instead of re-identifying —
 * no identify budget spent, and Discord replays the events missed during
 * the handoff gap.
 *
 * @discordjs/ws updates the sequence on every dispatch, so writes are
 * debounced through an in-memory cache; the cache is authoritative within
 * the process, Redis is the handoff medium. Call {@link close} (which
 * flushes) before exiting.
 */
export class RedisSessionStore {
  private readonly cache = new Map<number, SessionInfo | null>()
  /** Revision per dirty shard. A write only clears the revision it observed,
   * so an update racing an in-flight Redis command remains dirty. */
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
    // The cache is authoritative once warm: it holds newer state than Redis
    // between flushes, and retrieve() runs on the gateway hot path.
    if (this.cache.has(shardId)) {
      return this.cache.get(shardId) ?? null
    }

    const raw = await this.redis.get(this.key(shardId))
    let session: SessionInfo | null = null
    if (raw) {
      try {
        session = JSON.parse(raw) as SessionInfo
      } catch (error) {
        // A corrupt persisted session must read as "no session" (falling
        // back to a fresh identify), not crash the shard: the hook contract
        // with @discordjs/ws is SessionInfo | null.
        this.onError(error)
        try {
          await this.redis.del(this.key(shardId))
        } catch {
          // the corrupt key will age out via its TTL
        }
      }
    }
    this.cache.set(shardId, session)
    return session
  }

  public update(shardId: number, session: SessionInfo | null): void {
    this.cache.set(shardId, session)
    this.dirty.set(shardId, ++this.revision)

    // Null updates also need a retry path: their eager delete can fail, and
    // leaving the old Redis value until its 15-minute TTL would hand a future
    // owner a session Discord has already invalidated.
    this.ensureFlushTimer()

    if (session === null) {
      // Invalidations shouldn't linger in the debounce window; a stale
      // session in Redis would send the next owner into a doomed resume.
      void this.flush().catch(this.onError)
      return
    }
  }

  private ensureFlushTimer(): void {
    if (!this.timer) {
      this.timer = setInterval(() => {
        void this.flush().catch(this.onError)
      }, this.flushIntervalMillis)
      // The flush loop must never keep an exiting worker alive.
      this.timer.unref()
    }
  }

  public async flush(): Promise<void> {
    // Concurrent callers join the active pass, then re-check dirty state:
    // an update can land after that pass took its snapshot but before it
    // resolves, and the caller that observed the update must not return early.
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
        // Leave the observed revision dirty. Continue with other shards so
        // one unavailable key does not discard or starve unrelated sessions.
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
    await this.flush()
  }
}

interface SessionHookHost {
  options: {
    retrieveSessionInfo(shardId: number): unknown
    updateSessionInfo(shardId: number, session: SessionInfo | null): unknown
  }
}

/**
 * discord.js hardcodes the @discordjs/ws session hooks to an in-memory map
 * and only exposes buildIdentifyThrottler/buildStrategy for passthrough, so
 * the hooks are redirected by intercepting the internal manager the moment
 * discord.js assigns it (it consults `manager.options` dynamically on every
 * call, so rewiring the options object is sufficient).
 */
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

  // discord.js keeps its own in-memory copy on each WebSocketShard, which
  // internal packet handlers (e.g. RESUMED reading sessionInfo.sequence)
  // consume directly. Our hooks displace the defaults that maintained that
  // copy, so it must be kept in sync or resumes crash the client.
  const mirror = (shardId: number, session: SessionInfo | null) => {
    // sessionInfo is typed private, but discord.js's own hooks assign it
    // exactly like this (WebSocketManager#connect).
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
