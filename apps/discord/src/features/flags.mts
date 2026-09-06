import { performance } from 'node:perf_hooks'
import { OFREPProvider } from '@openfeature/ofrep-provider'
import {
  type Client,
  ErrorCode,
  type EvaluationContext,
  type EvaluationDetails,
  type FlagValue,
  OpenFeature,
  type Provider,
  StandardResolutionReasons,
} from '@openfeature/server-sdk'
import * as Sentry from '@sentry/node'
import { DURATION_SECONDS_BOUNDARIES, metrics } from '@thesharks/analytics'
import type { LimitFlagKey } from '../premium/limits.mjs'
import {
  type ExperimentFlagKey,
  type ExperimentVariant,
  expiredFlagKeys,
  type FlagDefinition,
  type GateFlagKey,
  getFlagDefinition,
  type SettingFlagKey,
} from './registry.mjs'

export interface FlagLogger {
  info(...values: readonly unknown[]): void
  warn(...values: readonly unknown[]): void
}

export interface FeatureFlagOptions {
  provider?: Provider
  cacheTtlMs?: number
  /** Attached to every evaluation so targeting sees where a request ran. */
  baseContext?: EvaluationContext
  logger?: FlagLogger
  now?: () => number
  cooldownAfterFailures?: number
  cooldownMs?: number
}

export type EvaluationSource = 'default' | 'provider' | 'error' | 'cache'

const meter = metrics.getMeter('@thesharks/discord')
const evaluationCounter = meter.createCounter(
  'discord_feature_flag_evaluations_total',
  { description: 'Runtime flag evaluations by source and flag kind' },
)
const evaluationDuration = meter.createHistogram(
  'discord_feature_flag_evaluation_duration_seconds',
  {
    description: 'Time spent resolving runtime flags',
    unit: 's',
    advice: { explicitBucketBoundaries: DURATION_SECONDS_BOUNDARIES },
  },
)

const MAX_CACHE_ENTRIES = 10_000
const SOURCE_METADATA_KEY = 'wildbeastSource'
// Outage codes only; missing or mistyped flags must not trip the breaker.
const OUTAGE_ERROR_CODES: ReadonlySet<ErrorCode> = new Set([
  ErrorCode.GENERAL,
  ErrorCode.PROVIDER_NOT_READY,
  ErrorCode.PROVIDER_FATAL,
])

export function ofrepProvider(options: {
  url: string
  token?: string
}): Provider {
  return new OFREPProvider({
    baseUrl: options.url,
    // Fail over well before Discord's 3s interaction deadline.
    timeoutMs: 2_000,
    headers: options.token
      ? [['Authorization', `Bearer ${options.token}`]]
      : undefined,
  })
}

export function evaluationSource(
  details: EvaluationDetails<FlagValue>,
): EvaluationSource {
  if (details.flagMetadata[SOURCE_METADATA_KEY] === 'cache') return 'cache'
  if (details.errorCode) return 'error'
  return details.reason === StandardResolutionReasons.DEFAULT
    ? 'default'
    : 'provider'
}

function fallbackDetails<Value extends FlagValue>(
  flagKey: string,
  value: Value,
  error?: unknown,
): EvaluationDetails<Value> {
  return {
    flagKey,
    flagMetadata: {},
    value,
    reason: StandardResolutionReasons.DEFAULT,
    ...(error
      ? {
          errorCode: ErrorCode.GENERAL,
          errorMessage: error instanceof Error ? error.message : String(error),
        }
      : {}),
  }
}

function stableContextKey(context: EvaluationContext): string {
  return JSON.stringify(
    Object.entries(context).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
  )
}

/**
 * Optional OFREP runtime policy. In-code defaults always serve traffic
 * without it. Fresh cache wins, then the breaker serves stale-on-error, then
 * the provider is asked; outage fallbacks are evicted so the next call retries.
 */
export class FeatureFlags {
  private readonly provider?: Provider
  private readonly cacheTtlMs: number
  private readonly baseContext: EvaluationContext
  private readonly logger?: FlagLogger
  private readonly now: () => number
  private readonly cooldownAfterFailures: number
  private readonly cooldownMs: number
  private readonly cache = new Map<
    string,
    { expiresAt: number; details: Promise<EvaluationDetails<FlagValue>> }
  >()
  private readonly lastGood = new Map<string, EvaluationDetails<FlagValue>>()
  private consecutiveFailures = 0
  private cooldownUntil = 0
  private active = false
  private client?: Client

  public constructor(options: FeatureFlagOptions = {}) {
    if (options.provider) this.provider = options.provider
    this.cacheTtlMs = Math.max(0, options.cacheTtlMs ?? 30_000)
    this.baseContext = options.baseContext ?? {}
    if (options.logger) this.logger = options.logger
    this.now = options.now ?? Date.now
    this.cooldownAfterFailures = options.cooldownAfterFailures ?? 3
    this.cooldownMs = options.cooldownMs ?? 30_000
  }

  public get isActive(): boolean {
    return this.active
  }

  /** Never throws: a failed flag service must not block login. */
  public async open(): Promise<void> {
    for (const key of expiredFlagKeys()) {
      this.logger?.warn(`Runtime flag ${key} is past its expiry date`)
    }
    if (!this.provider) return
    this.reset()
    try {
      // A dedicated domain keeps this instance's provider separate from any other.
      await OpenFeature.setProviderAndWait(this.domain, this.provider)
      this.logger?.info(
        `Feature flag provider ready: ${this.provider.metadata.name}`,
      )
    } catch (error) {
      this.logger?.warn(
        'Feature flag provider failed to initialize; runtime policies use built-in defaults until it recovers',
        error,
      )
    }
    this.client = OpenFeature.getClient(this.domain)
    this.active = true
  }

  public async close(): Promise<void> {
    if (!this.active) return
    this.active = false
    this.client = undefined
    this.reset()
    // OpenFeature has no per-domain clear; releasing the provider is enough
    // because every instance owns a distinct domain.
    await this.provider?.onClose?.()
  }

  private readonly domain = `wildbeast:${Math.random().toString(36).slice(2)}`

  private reset(): void {
    this.cache.clear()
    this.lastGood.clear()
    this.consecutiveFailures = 0
    this.cooldownUntil = 0
  }

  public gate(key: GateFlagKey, context: EvaluationContext) {
    const definition = getFlagDefinition(key)
    return this.evaluate({
      key,
      fallback: definition.defaultValue,
      context,
      kind: definition.kind,
      evaluate: (client, merged) =>
        client.getBooleanDetails(key, definition.defaultValue, merged),
    })
  }

  public async enabled(
    key: GateFlagKey,
    context: EvaluationContext,
  ): Promise<boolean> {
    return (await this.gate(key, context)).value
  }

  public experiment<Key extends ExperimentFlagKey>(
    key: Key,
    context: EvaluationContext,
  ): Promise<EvaluationDetails<ExperimentVariant<Key>>> {
    const definition = getFlagDefinition(key)
    return this.evaluate({
      key,
      fallback: definition.defaultValue,
      context,
      kind: definition.kind,
      evaluate: (client, merged) =>
        client.getStringDetails(key, definition.defaultValue, merged),
    }) as Promise<EvaluationDetails<ExperimentVariant<Key>>>
  }

  public setting(
    key: SettingFlagKey,
    context: EvaluationContext,
  ): Promise<EvaluationDetails<string>> {
    const definition = getFlagDefinition(key)
    return this.evaluate({
      key,
      fallback: definition.defaultValue,
      context,
      kind: definition.kind,
      evaluate: (client, merged) =>
        client.getStringDetails(key, definition.defaultValue, merged),
    })
  }

  public async limit(
    key: LimitFlagKey,
    fallback: number,
    context: EvaluationContext,
  ): Promise<number> {
    return (await this.limitDetails(key, fallback, context)).value
  }

  public limitDetails(
    key: LimitFlagKey,
    fallback: number,
    context: EvaluationContext,
  ): Promise<EvaluationDetails<number>> {
    return this.evaluate({
      key,
      fallback,
      context,
      kind: 'limit',
      evaluate: (client, merged) =>
        client.getNumberDetails(key, fallback, merged),
    })
  }

  private async evaluate<Value extends FlagValue>(options: {
    key: string
    fallback: Value
    context: EvaluationContext
    kind: FlagDefinition['kind'] | 'limit'
    evaluate(
      client: Client,
      context: EvaluationContext,
    ): Promise<EvaluationDetails<Value>>
  }): Promise<EvaluationDetails<Value>> {
    const startedAt = performance.now()
    const context = { ...this.baseContext, ...options.context }
    const details =
      this.active && this.client
        ? await this.resolve({ ...options, context }, this.client)
        : fallbackDetails(options.key, options.fallback)
    this.record(details, options.kind, startedAt, options.fallback)
    return details
  }

  private async resolve<Value extends FlagValue>(
    options: {
      key: string
      fallback: Value
      context: EvaluationContext
      evaluate(
        client: Client,
        context: EvaluationContext,
      ): Promise<EvaluationDetails<Value>>
    },
    client: Client,
  ): Promise<EvaluationDetails<Value>> {
    const now = this.now()
    const cacheKey = `${options.key}\n${stableContextKey(options.context)}`
    const cached = (details: EvaluationDetails<FlagValue>) =>
      ({
        ...(details as EvaluationDetails<Value>),
        flagMetadata: {
          ...details.flagMetadata,
          [SOURCE_METADATA_KEY]: 'cache',
        },
      }) as EvaluationDetails<Value>
    if (this.cacheTtlMs > 0) {
      const entry = this.cache.get(cacheKey)
      if (entry && entry.expiresAt > now) return cached(await entry.details)
    }
    if (now < this.cooldownUntil) {
      const stale = this.lastGood.get(cacheKey)
      if (stale) return cached(stale)
      return fallbackDetails(
        options.key,
        options.fallback,
        new Error('flag provider is cooling down after repeated failures'),
      )
    }
    const pending = options
      .evaluate(client, options.context)
      .catch((error) => fallbackDetails(options.key, options.fallback, error))
    if (this.cacheTtlMs > 0) {
      this.prune(now)
      this.cache.set(cacheKey, {
        expiresAt: now + this.cacheTtlMs,
        details: pending,
      })
    }
    const details = await pending
    if (details.errorCode && OUTAGE_ERROR_CODES.has(details.errorCode)) {
      this.consecutiveFailures += 1
      if (this.consecutiveFailures >= this.cooldownAfterFailures) {
        this.cooldownUntil = this.now() + this.cooldownMs
        this.consecutiveFailures = 0
      }
      if (this.cache.get(cacheKey)?.details === pending)
        this.cache.delete(cacheKey)
    } else if (details.errorCode) {
      this.consecutiveFailures = 0
    } else {
      this.consecutiveFailures = 0
      this.rememberLastGood(cacheKey, details)
    }
    return details
  }

  private prune(now: number): void {
    if (this.cache.size < MAX_CACHE_ENTRIES) return
    for (const [key, entry] of this.cache) {
      if (entry.expiresAt <= now) this.cache.delete(key)
    }
    for (const key of this.cache.keys()) {
      if (this.cache.size < MAX_CACHE_ENTRIES) break
      this.cache.delete(key)
    }
  }

  private rememberLastGood(
    key: string,
    details: EvaluationDetails<FlagValue>,
  ): void {
    if (!this.lastGood.has(key) && this.lastGood.size >= MAX_CACHE_ENTRIES) {
      const oldest = this.lastGood.keys().next().value
      if (oldest !== undefined) this.lastGood.delete(oldest)
    }
    this.lastGood.delete(key)
    this.lastGood.set(key, details)
  }

  private record(
    details: EvaluationDetails<FlagValue>,
    kind: FlagDefinition['kind'] | 'limit',
    startedAt: number,
    fallback: FlagValue,
  ): void {
    const labels = {
      flag: details.flagKey,
      kind,
      source: evaluationSource(details),
      ...(typeof details.value === 'boolean'
        ? { state: details.value ? 'enabled' : 'disabled' }
        : {}),
    }
    evaluationCounter.add(1, labels)
    evaluationDuration.record(
      Math.max(0, performance.now() - startedAt) / 1_000,
      labels,
    )
    try {
      Sentry.getClient()
        ?.getIntegrationByName<
          ReturnType<typeof Sentry.featureFlagsIntegration>
        >('FeatureFlags')
        ?.addFeatureFlag(
          details.flagKey,
          typeof details.value === 'boolean'
            ? details.value
            : details.value !== fallback,
        )
    } catch {
      // Error context is best effort.
    }
  }
}
