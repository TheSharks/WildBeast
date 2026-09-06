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

// 5s identify spacing per bucket plus margin for clock drift.
export const IDENTIFY_WINDOW_MILLIS = 5_500

// Minimal Redis surface for testability.
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
  /** Lock prefix; bots sharing Redis need distinct prefixes or they throttle each other. */
  keyPrefix?: string
  /** Sink for PTTL anomalies; defaults to console.warn. */
  onWarn?: (message: string) => void
}

// Per-bot lock namespace (hashed token, never raw — PII); WILDBEAST_CLUSTER wins when set.
// feat/v9 changed this prefix: interim mixed fleets throttle independently (accepted, no fallback).
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

// Fleet-wide identify pacing per bucket; lock expiry is the spacing, never released early.
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

      // Wait out the holder's window; jitter avoids a stampede.
      const remaining = await this.redis.pttl(key)
      let baseDelay: number
      if (remaining < 0) {
        // -2: expiry race; -1: key without TTL that never expires. Back off full window.
        this.onWarn(
          `Identify lock ${key} returned PTTL ${remaining}; backing off for the full identify window`,
        )
        baseDelay = this.windowMillis
      } else {
        // Cap skew-inflated TTLs.
        baseDelay = Math.min(remaining, this.windowMillis)
      }
      const delay = baseDelay + Math.floor(Math.random() * 250)
      await sleep(delay, undefined, { signal })
    }
  }
}

// discord.js `ClientOptions#ws.buildIdentifyThrottler` entrypoint.
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
