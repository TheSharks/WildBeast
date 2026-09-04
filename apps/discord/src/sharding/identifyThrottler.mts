import { createHash } from 'node:crypto'
import { setTimeout as sleep } from 'node:timers/promises'
import { DURATION_SECONDS_BOUNDARIES, metrics } from '@thesharks/analytics'
import type { IIdentifyThrottler, WebSocketOptions } from 'discord.js'
import { getSharedWorkerRedis } from '../utils/redis.mjs'

const meter = metrics.getMeter('@thesharks/discord')
const identifyCounter = meter.createCounter('discord_identifies_total', {
  description: 'Gateway identifies performed, by rate limit bucket',
})
const identifyWait = meter.createHistogram('discord_identify_wait_seconds', {
  description: 'Time spent waiting for the global identify rate limit',
  unit: 's',
  advice: { explicitBucketBoundaries: DURATION_SECONDS_BOUNDARIES },
})

// Discord requires 5s between identifies per bucket; a little margin covers
// clock drift between clusters.
const IDENTIFY_WINDOW_MILLIS = 5_500

/**
 * The subset of Redis commands the throttler needs; keeps the class testable
 * without a Redis server.
 */
export interface IdentifyLockStore {
  set(
    key: string,
    value: string,
    millisecondsToken: 'PX',
    milliseconds: number,
    nx: 'NX',
  ): Promise<'OK' | null>
  pttl(key: string): Promise<number>
}

export interface IdentifyThrottlerOptions {
  /**
   * Redis key prefix for identify locks (without the trailing bucket).
   * Defaults to `wildbeast:identify`. Different bots sharing one Redis must
   * use different prefixes (see {@link identifyKeyPrefix}) or they throttle
   * each other on the same keys.
   */
  keyPrefix?: string
  /** Sink for PTTL anomalies; defaults to console.warn. */
  onWarn?: (message: string) => void
}

/**
 * Namespace identify locks per bot so fleets sharing one Redis don't
 * throttle each other. The Discord token is hashed (never stored raw in a
 * key); an explicit `WILDBEAST_CLUSTER` namespace wins when set so
 * environments can isolate without exposing a token hash.
 */
export function identifyKeyPrefix(
  token?: string,
  namespaceEnv?: string,
  base = 'wildbeast',
): string {
  const namespace = namespaceEnv ?? process.env.WILDBEAST_CLUSTER
  if (namespace) return `${base}:${namespace}:identify`
  const secret = token ?? process.env.DISCORD_TOKEN
  if (!secret) return `${base}:identify`
  const hash = createHash('sha256').update(secret).digest('hex').slice(0, 12)
  return `${base}:${hash}:identify`
}

/**
 * Discord allows one identify per 5 seconds per rate limit bucket
 * (shard_id % max_concurrency), enforced per bot token across ALL processes.
 * This throttler serializes identifies fleet-wide through a Redis lock per
 * bucket so multiple clusters can't trip each other into invalid sessions.
 *
 * The lock is deliberately never released: letting it expire after the
 * identify window is exactly the spacing Discord requires.
 */
export class RedisIdentifyThrottler implements IIdentifyThrottler {
  private readonly keyPrefix: string
  private readonly onWarn: (message: string) => void

  public constructor(
    private readonly redis: IdentifyLockStore,
    private readonly maxConcurrency: number,
    private readonly windowMillis: number = IDENTIFY_WINDOW_MILLIS,
    options: IdentifyThrottlerOptions = {},
  ) {
    this.keyPrefix = options.keyPrefix ?? 'wildbeast:identify'
    this.onWarn = options.onWarn ?? ((message) => console.warn(message))
  }

  public async waitForIdentify(
    shardId: number,
    signal: AbortSignal,
  ): Promise<void> {
    const bucket = shardId % this.maxConcurrency
    const key = `${this.keyPrefix}:${bucket}`
    const labels = { bucket: String(bucket) }
    const startedAt = Date.now()

    for (;;) {
      signal.throwIfAborted()

      const acquired = await this.redis.set(
        key,
        String(shardId),
        'PX',
        this.windowMillis,
        'NX',
      )
      if (acquired === 'OK') {
        identifyCounter.add(1, labels)
        identifyWait.record((Date.now() - startedAt) / 1000, labels)
        return
      }

      // Wait out the current holder's window, with jitter so shards queued
      // on the same bucket don't stampede the lock.
      const remaining = await this.redis.pttl(key)
      let baseDelay: number
      if (remaining < 0) {
        // -2: key vanished between SET and PTTL (expiry race) — the next
        // acquire will likely succeed, but hammering every 100ms melts Redis
        // when the store is flapping. -1: key exists without a TTL
        // (legacy/manual write) and will never expire on its own.
        this.onWarn(
          `Identify lock ${key} returned PTTL ${remaining}; backing off for the full identify window`,
        )
        baseDelay = this.windowMillis
      } else {
        // Cap clock-skewed TTLs at the window: waiting longer only idles.
        baseDelay = Math.min(remaining, this.windowMillis)
      }
      const delay = baseDelay + Math.floor(Math.random() * 250)
      await sleep(delay, undefined, { signal })
    }
  }
}

/**
 * Plugs into discord.js via `ClientOptions#ws.buildIdentifyThrottler`.
 */
export const buildRedisIdentifyThrottler: NonNullable<
  WebSocketOptions['buildIdentifyThrottler']
> = async (manager) => {
  const info = await manager.fetchGatewayInformation()
  return new RedisIdentifyThrottler(
    getSharedWorkerRedis(),
    info.session_start_limit.max_concurrency,
    IDENTIFY_WINDOW_MILLIS,
    { keyPrefix: identifyKeyPrefix() },
  )
}
