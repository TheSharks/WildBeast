export type { Attributes, Span } from '@opentelemetry/api'
export { metrics, SpanStatusCode, trace } from '@opentelemetry/api'
export { logs } from '@opentelemetry/api-logs'
// The SDK instance initOpenTelemetry configures. Import Sentry from here, not
// from your own @sentry/node: a second copy has its own scope and never
// reaches the initialized client.
export * as Sentry from '@sentry/node'
export * from './local-metrics.js'
export * from './telemetry.js'
export * from './types.js'
export * from './utils/metrics.js'
