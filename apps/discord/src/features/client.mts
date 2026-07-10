import { performance } from 'node:perf_hooks'
import { OFREPProvider } from '@openfeature/ofrep-provider'
import {
  type Client,
  ErrorCode,
  type EvaluationContext,
  type EvaluationDetails,
  type FlagValue,
  type Hook,
  type HookContext,
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

class SentryFlagHook implements Hook {
  public after(
    hookContext: HookContext,
    details: EvaluationDetails<FlagValue>,
  ) {
    const integration =
      Sentry.getClient()?.getIntegrationByName<
        ReturnType<typeof Sentry.featureFlagsIntegration>
      >('FeatureFlags')
    if (!integration) return
    integration.addFeatureFlag(
      hookContext.flagKey,
      typeof details.value === 'boolean'
        ? details.value
        : details.value !== hookContext.defaultValue,
    )
  }
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

  OpenFeature.clearHooks()
  OpenFeature.addHooks(new SentryFlagHook())
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

export type EvaluationSource = 'default' | 'provider' | 'error'

export function evaluationSource(
  details: EvaluationDetails<FlagValue>,
): EvaluationSource {
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
}

async function safelyEvaluate<Value extends FlagValue>(options: {
  key: string
  fallback: Value
  kind: FlagDefinition['kind'] | 'limit'
  evaluate(client: Client): Promise<EvaluationDetails<Value>>
}): Promise<EvaluationDetails<Value>> {
  const startedAt = performance.now()
  let details: EvaluationDetails<Value>
  if (!active) {
    details = fallbackDetails(options.key, options.fallback)
  } else {
    try {
      details = await options.evaluate(featureFlagClient())
    } catch (error) {
      details = fallbackDetails(options.key, options.fallback, error)
    }
  }
  recordEvaluation(details, options.kind, startedAt)
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
    kind: 'limit',
    evaluate: (client) => client.getNumberDetails(key, fallback, context),
  })
  return details.value
}

export async function closeFeatureFlags(): Promise<void> {
  if (!active) return
  active = false
  await OpenFeature.close()
}
