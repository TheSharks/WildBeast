export interface TelemetryExporterConfig {
  endpoint?: string
  headers?: Record<string, string>
}

export interface TelemetryInstrumentationConfig {
  pg?: boolean
  undici?: boolean
}

export interface TelemetrySentryConfig {
  dsn?: string
  tracesSampleRate?: number
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
  exporters?: {
    otlp?: TelemetryExporterConfig
    traces?: TelemetryExporterConfig
    metrics?: TelemetryExporterConfig
    logs?: TelemetryExporterConfig
  }
  instrumentations?: TelemetryInstrumentationConfig
  sentry?: TelemetrySentryConfig
}
