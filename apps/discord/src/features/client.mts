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
} from './registry.mjs'

/**
 * Optional runtime policy via OpenFeature's Remote Evaluation Protocol.
 * Every evaluation has an in-code default, so flag infrastructure can never
 * become a prerequisite for serving Discord traffic.
 */

export interface FeatureFlagLogger {
  info(...values: readonly unknown[]): void
  warn(...values: readonly unknown[]): void
}

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

let active = false

export function featureFlagsActive(): boolean {
  return active
}

/**
 * Evaluations are cached in-process per flag + context. A gated command
 * with a limit and an experiment makes up to three sequential provider
 * calls against Discord's three-second interaction deadline; the cache
 * collapses repeats within the TTL to zero calls, at the cost of remote
 * changes taking up to that long to propagate. Concurrent evaluations of
 * the same flag + context share one in-flight request.
 */
const DEFAULT_CACHE_TTL_SECONDS = 30
const MAX_CACHE_ENTRIES = 10_000

/**
 * Circuit breaker: after this many consecutive provider failures, skip the
 * provider entirely for the cooldown period so a dead flag service costs
 * one timeout per flag instead of stalling every cold interaction.
 */
const COOLDOWN_AFTER_FAILURES = 3
const COOLDOWN_MS = 30_000

/** Failures that mean the service itself is unhealthy — a merely missing
 * or mistyped flag must not trip the breaker. */
const OUTAGE_ERROR_CODES: ReadonlySet<ErrorCode> = new Set([
  ErrorCode.GENERAL,
  ErrorCode.PROVIDER_NOT_READY,
  ErrorCode.PROVIDER_FATAL,
])

const SOURCE_METADATA_KEY = 'wildbeastSource'

let cacheTtlMs = DEFAULT_CACHE_TTL_SECONDS * 1_000
const evaluationCache = new Map<
  string,
  { expiresAt: number; details: Promise<EvaluationDetails<FlagValue>> }
>()
let consecutiveFailures = 0
let cooldownUntil = 0

function resetEvaluationState(env: NodeJS.ProcessEnv = process.env): void {
  evaluationCache.clear()
  consecutiveFailures = 0
  cooldownUntil = 0
  const ttl = Number(env.WILDBEAST_OFREP_CACHE_TTL ?? DEFAULT_CACHE_TTL_SECONDS)
  cacheTtlMs = Number.isFinite(ttl) && ttl >= 0 ? ttl * 1_000 : 0
}

export function providerFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): Provider | undefined {
  const baseUrl = env.WILDBEAST_OFREP_URL
  if (!baseUrl) return undefined
  return new OFREPProvider({
    baseUrl,
    // Evaluations sit on interaction paths. Fail over to the in-code default
    // well before Discord's three-second initial response deadline.
    timeoutMs: 2_000,
    headers: env.WILDBEAST_OFREP_TOKEN
      ? [['Authorization', `Bearer ${env.WILDBEAST_OFREP_TOKEN}`]]
      : undefined,
  })
}

export async function initFeatureFlags(options: {
  logger: FeatureFlagLogger
  provider?: Provider
}): Promise<boolean> {
  for (const key of expiredFlagKeys()) {
    options.logger.warn(`Runtime flag ${key} is past its expiry date`)
  }

  const provider = options.provider ?? providerFromEnv()
  if (!provider) return false

  resetEvaluationState()
  try {
    await OpenFeature.setProviderAndWait(provider)
    options.logger.info(
      `Feature flag provider ready: ${provider.metadata.name}`,
    )
  } catch (error) {
    options.logger.warn(
      'Feature flag provider failed to initialize; runtime policies use built-in defaults until it recovers',
      error,
    )
  }
  active = true
  return true
}

export function featureFlagClient(): Client {
  return OpenFeature.getClient()
}

export type EvaluationSource = 'default' | 'provider' | 'error' | 'cache'

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

function recordEvaluation(
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
  // Sentry's per-scope flag buffer, so error events carry the flag state
  // that was live when things broke. Reported here rather than through an
  // OpenFeature hook so cached and fallback evaluations are captured too.
  // The buffer is boolean-only: booleans pass through, other types record
  // whether the value diverged from the in-code default — the question a
  // debugger actually asks.
  Sentry.getClient()
    ?.getIntegrationByName<ReturnType<typeof Sentry.featureFlagsIntegration>>(
      'FeatureFlags',
    )
    ?.addFeatureFlag(
      details.flagKey,
      typeof details.value === 'boolean'
        ? details.value
        : details.value !== fallback,
    )
}

function stableContextKey(context: EvaluationContext): string {
  return JSON.stringify(
    Object.entries(context).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
  )
}

/** Evict expired entries — and, if the cache is still over budget, the
 * oldest ones — so per-user context keys cannot grow the map unbounded. */
function pruneCache(now: number): void {
  if (evaluationCache.size < MAX_CACHE_ENTRIES) return
  for (const [key, entry] of evaluationCache) {
    if (entry.expiresAt <= now) evaluationCache.delete(key)
  }
  for (const key of evaluationCache.keys()) {
    if (evaluationCache.size < MAX_CACHE_ENTRIES) break
    evaluationCache.delete(key)
  }
}

function trackProviderHealth(details: EvaluationDetails<FlagValue>): void {
  if (details.errorCode && OUTAGE_ERROR_CODES.has(details.errorCode)) {
    consecutiveFailures += 1
    if (consecutiveFailures >= COOLDOWN_AFTER_FAILURES) {
      cooldownUntil = Date.now() + COOLDOWN_MS
      consecutiveFailures = 0
    }
  } else {
    consecutiveFailures = 0
  }
}

async function resolveDetails<Value extends FlagValue>(options: {
  key: string
  fallback: Value
  context: EvaluationContext
  evaluate(client: Client): Promise<EvaluationDetails<Value>>
}): Promise<EvaluationDetails<Value>> {
  const now = Date.now()
  if (now < cooldownUntil) {
    return fallbackDetails(
      options.key,
      options.fallback,
      new Error('flag provider is cooling down after repeated failures'),
    )
  }

  const cacheKey =
    cacheTtlMs > 0
      ? `${options.key}\n${stableContextKey(options.context)}`
      : undefined
  if (cacheKey) {
    const entry = evaluationCache.get(cacheKey)
    if (entry && entry.expiresAt > now) {
      const details = await entry.details
      return {
        ...(details as EvaluationDetails<Value>),
        flagMetadata: {
          ...details.flagMetadata,
          [SOURCE_METADATA_KEY]: 'cache',
        },
      }
    }
  }

  const pending = options
    .evaluate(featureFlagClient())
    .catch((error) => fallbackDetails(options.key, options.fallback, error))
  if (cacheKey) {
    pruneCache(now)
    evaluationCache.set(cacheKey, {
      expiresAt: now + cacheTtlMs,
      details: pending,
    })
  }
  const details = await pending
  trackProviderHealth(details)
  return details
}

async function safelyEvaluate<Value extends FlagValue>(options: {
  key: string
  fallback: Value
  context: EvaluationContext
  kind: FlagDefinition['kind'] | 'limit'
  evaluate(client: Client): Promise<EvaluationDetails<Value>>
}): Promise<EvaluationDetails<Value>> {
  const startedAt = performance.now()
  const details = active
    ? await resolveDetails(options)
    : fallbackDetails(options.key, options.fallback)
  recordEvaluation(details, options.kind, startedAt, options.fallback)
  return details
}

export function booleanFlagDetails<Key extends GateFlagKey>(
  key: Key,
  context: EvaluationContext,
): Promise<EvaluationDetails<boolean>> {
  const definition = getFlagDefinition(key)
  return safelyEvaluate({
    key,
    fallback: definition.defaultValue,
    context,
    kind: definition.kind,
    evaluate: (client) =>
      client.getBooleanDetails(key, definition.defaultValue, context),
  })
}

export async function booleanFlagValue<Key extends GateFlagKey>(
  key: Key,
  context: EvaluationContext,
): Promise<boolean> {
  return (await booleanFlagDetails(key, context)).value
}

/**
 * Raw experiment evaluation. The provider may return any string, so
 * `details.value` is only trustworthy after checking it against the
 * registry's variants — `experimentVariant` (features/experiments.mjs) does
 * that plus exposure accounting, and is the API feature code should use.
 */
export function experimentFlagDetails<Key extends ExperimentFlagKey>(
  key: Key,
  context: EvaluationContext,
): Promise<EvaluationDetails<ExperimentVariant<Key>>> {
  const definition = getFlagDefinition(key)
  return safelyEvaluate({
    key,
    fallback: definition.defaultValue,
    context,
    kind: definition.kind,
    evaluate: (client) =>
      client.getStringDetails(key, definition.defaultValue, context),
  }) as Promise<EvaluationDetails<ExperimentVariant<Key>>>
}

/** Resolve a remote limit override; the tier's registry value is both the
 * flag default and the answer on any failure. */
export async function limitFlagValue(
  key: LimitFlagKey,
  fallback: number,
  context: EvaluationContext,
): Promise<number> {
  const details = await safelyEvaluate({
    key,
    fallback,
    context,
    kind: 'limit',
    evaluate: (client) => client.getNumberDetails(key, fallback, context),
  })
  return details.value
}

export async function closeFeatureFlags(): Promise<void> {
  if (!active) return
  active = false
  resetEvaluationState()
  await OpenFeature.close()
}
