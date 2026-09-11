import type { Attributes } from '@opentelemetry/api'
import type { MetricReader } from '@opentelemetry/sdk-metrics'
import type { NodeOptions } from '@sentry/node'

export interface TelemetryExporterConfig {
  endpoint?: string
  headers?: Record<string, string>
  protocol?: 'http' | 'grpc'
  timeout?: number
  compression?: 'gzip' | 'none'
}

export interface TelemetryInstrumentationConfig {
  pg?: boolean
  undici?: boolean
  ioredis?: boolean
  fs?: boolean
  runtimeNode?: boolean
}

export interface TelemetrySentryConfig {
  dsn?: string
  tracesSampleRate?: number
  /**
   * Sampling override; prefers interesting spans over noisy ones.
   */
  tracesSampler?: NodeOptions['tracesSampler']
  environment?: string
  release?: string
  enableLogs?: boolean
  /**
   * Sentry metrics for low-volume use only; never mirror hot OTel counters.
   */
  enableMetrics?: boolean
  /** Capture local variables in exception stack frames. Defaults to true. */
  includeLocalVariables?: boolean
  /** No trace header propagation by default; keeps {fetch:} hosts from seeing trace headers. */
  tracePropagationTargets?: NodeOptions['tracePropagationTargets']
  /** Forward events to a local Spotlight sidecar for development. */
  spotlight?: boolean
  /** Tags applied to every event from this process (e.g. cluster.id). */
  tags?: Record<string, string>
  /** Profiling sample rate 0-1; default 0 (off). */
  profileSessionSampleRate?: number
  /** Event-loop-block threshold ms, or false to disable; default 1000. */
  eventLoopBlockThreshold?: number | false
  /** Runs after PII scrub; return null to drop the event. */
  beforeSend?: NodeOptions['beforeSend']
}

export interface TelemetryConfig {
  /** Additional local readers, independent of OTLP export configuration. */
  metricReaders?: MetricReader[]
  serviceName?: string
  serviceVersion?: string
  environment?: string
  namespace?: string
  instanceId?: string
  shardId?: string
  diagnosticLogLevel?: 'none' | 'debug'
  enableExport?: boolean
  /** Max flush wait on shutdown; default 10s. */
  shutdownTimeoutMillis?: number
  /** Extra resource attributes; core keys win on conflict. */
  resourceAttributes?: Attributes
  exporters?: {
    otlp?: TelemetryExporterConfig | TelemetryExporterConfig[]
    traces?: TelemetryExporterConfig | TelemetryExporterConfig[]
    metrics?: TelemetryExporterConfig | TelemetryExporterConfig[]
    logs?: TelemetryExporterConfig | TelemetryExporterConfig[]
  }
  instrumentations?: TelemetryInstrumentationConfig
  sentry?: TelemetrySentryConfig
}
