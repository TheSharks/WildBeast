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

// Optional OFREP runtime policy; in-code defaults always let traffic serve without it.

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

// Per flag+context cache collapses repeats against the 3s interaction deadline; concurrent hits share one request.
// Order: fresh cache (survives cooldown) -> breaker serving stale-on-error -> live evaluation (outage results evicted).
const DEFAULT_CACHE_TTL_SECONDS = 30
const MAX_CACHE_ENTRIES = 10_000

// Breaker: after N consecutive failures skip the provider for cooldown, serving stale-on-error per key.
const COOLDOWN_AFTER_FAILURES = 3
const COOLDOWN_MS = 30_000

// Outage codes only; missing/mistyped flags must not trip the breaker.
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
const lastGoodEvaluations = new Map<string, EvaluationDetails<FlagValue>>()
let consecutiveFailures = 0
let cooldownUntil = 0

function resetEvaluationState(env: NodeJS.ProcessEnv = process.env): void {
  evaluationCache.clear()
  lastGoodEvaluations.clear()
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
    // Fail over well before Discord's 3s interaction deadline.
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
  // Sentry flag buffer so errors carry live flag state, including cached/fallback evaluations.
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

// Evict expired then oldest so per-user keys stay bounded.
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

function rememberLastGood(
  key: string,
  details: EvaluationDetails<FlagValue>,
): void {
  if (
    !lastGoodEvaluations.has(key) &&
    lastGoodEvaluations.size >= MAX_CACHE_ENTRIES
  ) {
    const oldest = lastGoodEvaluations.keys().next().value
    if (oldest !== undefined) lastGoodEvaluations.delete(oldest)
  }
  // Refresh insertion order so recently healthy contexts survive eviction.
  lastGoodEvaluations.delete(key)
  lastGoodEvaluations.set(key, details)
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
  const cacheKey = `${options.key}\n${stableContextKey(options.context)}`
  if (cacheTtlMs > 0) {
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

  if (now < cooldownUntil) {
    const stale = lastGoodEvaluations.get(cacheKey)
    if (stale) {
      return {
        ...(stale as EvaluationDetails<Value>),
        flagMetadata: {
          ...stale.flagMetadata,
          [SOURCE_METADATA_KEY]: 'cache',
        },
      }
    }
    return fallbackDetails(
      options.key,
      options.fallback,
      new Error('flag provider is cooling down after repeated failures'),
    )
  }

  const pending = options
    .evaluate(featureFlagClient())
    .catch((error) => fallbackDetails(options.key, options.fallback, error))
  if (cacheTtlMs > 0) {
    pruneCache(now)
    evaluationCache.set(cacheKey, {
      expiresAt: now + cacheTtlMs,
      details: pending,
    })
  }
  const details = await pending
  trackProviderHealth(details)
  if (details.errorCode) {
    // Evict outage fallbacks so the next call retries; keep config errors cached.
    if (
      OUTAGE_ERROR_CODES.has(details.errorCode) &&
      evaluationCache.get(cacheKey)?.details === pending
    ) {
      evaluationCache.delete(cacheKey)
    }
  } else {
    rememberLastGood(cacheKey, details)
  }
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

// Raw experiment evaluation; use experimentVariant (validates + accounts exposure) instead.
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

// Remote limit override; registry value is the default and the failure answer.
export function limitFlagDetails(
  key: LimitFlagKey,
  fallback: number,
  context: EvaluationContext,
): Promise<EvaluationDetails<number>> {
  return safelyEvaluate({
    key,
    fallback,
    context,
    kind: 'limit',
    evaluate: (client) => client.getNumberDetails(key, fallback, context),
  })
}

export async function limitFlagValue(
  key: LimitFlagKey,
  fallback: number,
  context: EvaluationContext,
): Promise<number> {
  return (await limitFlagDetails(key, fallback, context)).value
}

export async function closeFeatureFlags(): Promise<void> {
  if (!active) return
  active = false
  resetEvaluationState()
  await OpenFeature.close()
}
