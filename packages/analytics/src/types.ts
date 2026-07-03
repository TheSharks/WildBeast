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
  exporters?: {
    otlp?: TelemetryExporterConfig | TelemetryExporterConfig[]
    traces?: TelemetryExporterConfig | TelemetryExporterConfig[]
    metrics?: TelemetryExporterConfig | TelemetryExporterConfig[]
    logs?: TelemetryExporterConfig | TelemetryExporterConfig[]
  }
  instrumentations?: TelemetryInstrumentationConfig
  sentry?: TelemetrySentryConfig
}
