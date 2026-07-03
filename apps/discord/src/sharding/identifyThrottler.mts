import { setTimeout as sleep } from 'node:timers/promises'
import { DURATION_SECONDS_BOUNDARIES, metrics } from '@thesharks/analytics'
import type { IIdentifyThrottler, WebSocketOptions } from 'discord.js'
import { Redis } from 'ioredis'
import { redisConnectionOptions } from '../utils/redis.mjs'

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
  public constructor(
    private readonly redis: IdentifyLockStore,
    private readonly maxConcurrency: number,
    private readonly windowMillis: number = IDENTIFY_WINDOW_MILLIS,
  ) {}

  public async waitForIdentify(
    shardId: number,
    signal: AbortSignal,
  ): Promise<void> {
    const bucket = shardId % this.maxConcurrency
    const key = `wildbeast:identify:${bucket}`
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
      const delay = Math.max(remaining, 100) + Math.floor(Math.random() * 250)
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
  const redis = new Redis(redisConnectionOptions())
  return new RedisIdentifyThrottler(
    redis,
    info.session_start_limit.max_concurrency,
  )
}
