import type { Attributes } from '@opentelemetry/api'
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
   * Per-span sampling decision; takes precedence over `tracesSampleRate`.
   * Useful for biasing sampling towards interesting spans (commands) and
   * away from noisy ones (recurring tasks).
   */
  tracesSampler?: NodeOptions['tracesSampler']
  environment?: string
  release?: string
  enableLogs?: boolean
  /**
   * Enable the Sentry metrics product. Defaults to true. Sentry metrics are
   * per-item and trace-associated (no client-side aggregation), so they're
   * reserved for low-volume measurements that OTel instruments don't cover;
   * never mirror hot-path OTel counters into them.
   */
  enableMetrics?: boolean
  /** Capture local variables in exception stack frames. Defaults to true. */
  includeLocalVariables?: boolean
  /**
   * URLs that receive `sentry-trace`/`baggage` headers on outgoing requests.
   * Defaults to none: nothing downstream of the bot continues our traces,
   * and user-controlled fetches (tagscript `{fetch:}`) reach arbitrary hosts
   * that should not see trace headers.
   */
  tracePropagationTargets?: NodeOptions['tracePropagationTargets']
  /** Forward events to a local Spotlight sidecar for development. */
  spotlight?: boolean
  /** Tags applied to every event from this process (e.g. cluster.id). */
  tags?: Record<string, string>
  /**
   * Continuous profiling session sample rate (0-1), evaluated once at
   * startup. Profiles are collected while a sampled trace is active.
   * Defaults to 0 (profiler off, native addon never loaded).
   */
  profileSessionSampleRate?: number
  /**
   * Event-loop-block detection threshold in milliseconds, or false to
   * disable. Defaults to 1000. Only active when a DSN is configured; the
   * watchdog runs on the main thread and observes worker threads too.
   */
  eventLoopBlockThreshold?: number | false
}

export interface TelemetryConfig {
  serviceName?: string
  serviceVersion?: string
  environment?: string
  namespace?: string
  instanceId?: string
  shardId?: string
  diagnosticLogLevel?: 'none' | 'debug'
  enableExport?: boolean
  /** Upper bound for flushing telemetry on shutdown. Defaults to 10 seconds. */
  shutdownTimeoutMillis?: number
  /**
   * Extra resource attributes (e.g. `cluster.id`). Core attributes such as
   * `service.name` take precedence on conflict.
   */
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
