import { createGauge, metrics } from '@thesharks/analytics'

type Meter = ReturnType<typeof metrics.getMeter>

/** The instrumentation scope every metric and span of this app is recorded under. */
export const INSTRUMENTATION_SCOPE = '@thesharks/discord'

const current = () => metrics.getMeter(INSTRUMENTATION_SCOPE)

/**
 * The app's one meter. Create every counter and histogram from it.
 *
 * It looks the real meter up on every call instead of once at import: an
 * instrument created before `initOpenTelemetry` registers the provider never
 * records, and this module can load earlier than that.
 */
export const meter: Pick<
  Meter,
  'createCounter' | 'createHistogram' | 'createObservableCounter'
> = {
  createCounter: (name, options) => current().createCounter(name, options),
  createHistogram: (name, options) => current().createHistogram(name, options),
  createObservableCounter: (name, options) =>
    current().createObservableCounter(name, options),
}

/** A settable gauge on the app's meter. */
export function gauge(name: string, description: string, unit?: string) {
  return createGauge(INSTRUMENTATION_SCOPE, name, description, unit)
}
