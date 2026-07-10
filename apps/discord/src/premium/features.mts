import { OFREPProvider } from '@openfeature/ofrep-provider'
import type {
  Client,
  EvaluationDetails,
  FlagValue,
  Hook,
  HookContext,
  Provider,
} from '@openfeature/server-sdk'
import { OpenFeature } from '@openfeature/server-sdk'
import * as Sentry from '@sentry/node'

/**
 * Optional feature flag support via OpenFeature's Remote Evaluation
 * Protocol (OFREP). When WILDBEAST_OFREP_URL points at an OFREP-compatible
 * service (flagd, GO Feature Flag, ...), flag evaluations — today the
 * limit registry's values — can be overridden remotely without a deploy.
 * Everything degrades to the in-code defaults when the variable is unset
 * or the service is unreachable; the bot never depends on it to run.
 */

export interface FeatureFlagLogger {
  info(...values: readonly unknown[]): void
  warn(...values: readonly unknown[]): void
}

let active = false

/** Whether a flag provider was configured this boot. Evaluation helpers
 * skip OpenFeature entirely (no async hop, no HTTP) when this is false. */
export function featureFlagsActive(): boolean {
  return active
}

/** The OFREP provider described by the environment, or undefined when
 * feature flags are not configured. */
export function providerFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): Provider | undefined {
  const baseUrl = env.WILDBEAST_OFREP_URL
  if (!baseUrl) return undefined
  return new OFREPProvider({
    baseUrl,
    // Evaluations sit on the command path; fail over to the in-code
    // defaults quickly instead of the provider's 10s default.
    timeoutMs: 2_000,
    headers: env.WILDBEAST_OFREP_TOKEN
      ? [['Authorization', `Bearer ${env.WILDBEAST_OFREP_TOKEN}`]]
      : undefined,
  })
}

/**
 * Report every flag evaluation to Sentry's feature flag buffer, so error
 * events carry the flag state that was live when things broke. Sentry's
 * flag context is boolean-only: boolean flags pass through as-is, other
 * types record whether a remote override diverged from the in-code
 * default — the question a debugger actually asks.
 */
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

/**
 * Register the flag provider (from the environment unless injected) and
 * the Sentry reporting hook. Returns false without side effects when no
 * provider is configured. A provider that fails to connect is kept: it
 * retries on its own, and evaluations return in-code defaults meanwhile.
 */
export async function initFeatureFlags(options: {
  logger: FeatureFlagLogger
  provider?: Provider
}): Promise<boolean> {
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
      'Feature flag provider failed to initialize; limits use built-in defaults until it recovers',
      error,
    )
  }
  active = true
  return true
}

export function featureFlagClient(): Client {
  return OpenFeature.getClient()
}

export async function closeFeatureFlags(): Promise<void> {
  if (!active) return
  active = false
  await OpenFeature.close()
}
