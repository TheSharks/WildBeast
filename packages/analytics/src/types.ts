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
    otlp?: TelemetryExporterConfig | TelemetryExporterConfig[]
    traces?: TelemetryExporterConfig | TelemetryExporterConfig[]
    metrics?: TelemetryExporterConfig | TelemetryExporterConfig[]
    logs?: TelemetryExporterConfig | TelemetryExporterConfig[]
  }
  instrumentations?: TelemetryInstrumentationConfig
  sentry?: TelemetrySentryConfig
}
