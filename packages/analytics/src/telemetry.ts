import {
  type Attributes,
  DiagConsoleLogger,
  DiagLogLevel,
  diag,
  metrics,
} from '@opentelemetry/api'
import { logs } from '@opentelemetry/api-logs'
import { OTLPLogExporter as OTLPLogGrpcExporter } from '@opentelemetry/exporter-logs-otlp-grpc'
import { OTLPLogExporter as OTLPLogHttpExporter } from '@opentelemetry/exporter-logs-otlp-http'
import { OTLPMetricExporter as OTLPMetricGrpcExporter } from '@opentelemetry/exporter-metrics-otlp-grpc'
import { OTLPMetricExporter as OTLPMetricHttpExporter } from '@opentelemetry/exporter-metrics-otlp-http'
import { OTLPTraceExporter as OTLPTraceGrpcExporter } from '@opentelemetry/exporter-trace-otlp-grpc'
import { OTLPTraceExporter as OTLPTraceHttpExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { registerInstrumentations } from '@opentelemetry/instrumentation'
import { FsInstrumentation } from '@opentelemetry/instrumentation-fs'
import { IORedisInstrumentation } from '@opentelemetry/instrumentation-ioredis'
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg'
import { UndiciInstrumentation } from '@opentelemetry/instrumentation-undici'
import { resourceFromAttributes } from '@opentelemetry/resources'
import {
  BatchLogRecordProcessor,
  LoggerProvider,
  type LogRecordProcessor,
} from '@opentelemetry/sdk-logs'
import {
  MeterProvider,
  type MetricReader,
  PeriodicExportingMetricReader,
} from '@opentelemetry/sdk-metrics'
import {
  BatchSpanProcessor,
  type SpanProcessor,
} from '@opentelemetry/sdk-trace-base'
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node'
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions'
import * as Sentry from '@sentry/node'
import {
  SentryPropagator,
  SentrySampler,
  SentrySpanProcessor,
} from '@sentry/opentelemetry'
import type { TelemetryConfig, TelemetryExporterConfig } from './types.js'

// from @opentelemetry/semantic-conventions/incubating
// recommendation is to copy relevant definitions into code base
const ATTR_DEPLOYMENT_ENVIRONMENT_NAME = 'deployment.environment.name'

export interface TelemetryInitResult {
  shutdown(): Promise<void>
}

function normalizeOtlpEndpointUrl(
  raw: string,
  signal: 'traces' | 'metrics' | 'logs',
): string {
  const value = raw.trim()

  if (!value) {
    return value
  }

  // gRPC exporters use a URL that looks like http(s)://host:4317
  if (value.startsWith('grpc://')) {
    const normalized = `http://${value.slice('grpc://'.length)}`
    diag.warn(
      `OTLP ${signal} endpoint uses grpc://; normalizing to ${normalized}`,
    )
    try {
      const url = new URL(normalized)
      return url.toString()
    } catch {
      throw new Error(`Invalid OTLP endpoint URL: ${normalized}`)
    }
  }

  // If the user passed host:port, assume http.
  if (!/^https?:\/\//.test(value)) {
    const normalized = `http://${value}`
    diag.warn(
      `OTLP ${signal} endpoint missing scheme; normalizing to ${normalized}`,
    )
    try {
      const url = new URL(normalized)
      return url.toString()
    } catch {
      throw new Error(`Invalid OTLP endpoint URL: ${normalized}`)
    }
  }

  return value
}

function parseOptOutBoolean(
  value: string | undefined,
  defaultValue: boolean,
): boolean {
  if (value === undefined) {
    return defaultValue
  }

  const normalized = value.trim().toLowerCase()
  if (normalized === 'false' || normalized === '0') {
    return false
  }
  if (normalized === 'true' || normalized === '1') {
    return true
  }

  return defaultValue
}

function resolveInstrumentationSetting(
  configValue: boolean | undefined,
  envValue: string | undefined,
  defaultValue: boolean,
): boolean {
  if (typeof configValue === 'boolean') {
    return configValue
  }

  return parseOptOutBoolean(envValue, defaultValue)
}

enum CompressionAlgorithm {
  NONE = 'none',
  GZIP = 'gzip',
}

function parseHeadersFromEnv(
  envString: string | undefined,
): Record<string, string> {
  const headers: Record<string, string> = {}

  if (!envString) {
    return headers
  }

  const pairs = envString.split(',')
  for (const pair of pairs) {
    const eqIndex = pair.indexOf('=')
    if (eqIndex === -1) {
      diag.warn(`Invalid header format, missing '=': "${pair.trim()}"`)
      continue
    }

    const key = pair.slice(0, eqIndex).trim()
    const value = pair.slice(eqIndex + 1).trim()

    if (key) {
      headers[key] = value
    }
  }

  return headers
}

function resolveProtocol(
  endpoint: string,
  protocolEnv?: string,
  configProtocol?: 'http' | 'grpc',
): 'http' | 'grpc' {
  if (configProtocol) {
    return configProtocol
  }

  if (protocolEnv) {
    if (protocolEnv === 'grpc') {
      return 'grpc'
    }
    if (protocolEnv === 'http/protobuf') {
      return 'http'
    }
    diag.warn(`Invalid protocol value: "${protocolEnv}"`)
  }

  try {
    const url = new URL(endpoint)
    if (url.protocol === 'grpc:' || url.protocol === 'grpcs:') {
      return 'grpc'
    }
  } catch {
    // Invalid URL, fall back to http
  }

  return 'http'
}

function resolveTransportConfig(
  signal: 'traces' | 'metrics' | 'logs',
  config?: TelemetryConfig,
): TelemetryExporterConfig[] {
  const envExporter: TelemetryExporterConfig = {}

  const globalHeaders = parseHeadersFromEnv(
    process.env.OTEL_EXPORTER_OTLP_HEADERS,
  )
  const signalHeadersEnv = `OTEL_EXPORTER_OTLP_${signal.toUpperCase()}_HEADERS`
  const signalHeaders = parseHeadersFromEnv(process.env[signalHeadersEnv])
  envExporter.headers = { ...globalHeaders, ...signalHeaders }

  const timeoutStr = process.env.OTEL_EXPORTER_OTLP_TIMEOUT
  if (timeoutStr) {
    const timeout = parseInt(timeoutStr, 10)
    if (!isNaN(timeout)) {
      envExporter.timeout = timeout
    } else {
      diag.warn(`Invalid timeout value: "${timeoutStr}"`)
    }
  }

  const compression = process.env.OTEL_EXPORTER_OTLP_COMPRESSION
  if (compression === 'gzip' || compression === 'none') {
    envExporter.compression = compression
  } else if (compression) {
    diag.warn(
      `Invalid compression value: "${compression}", defaulting to "gzip"`,
    )
    envExporter.compression = 'gzip'
  }

  const protocolEnv =
    process.env[`OTEL_EXPORTER_OTLP_${signal.toUpperCase()}_PROTOCOL`] ??
    process.env.OTEL_EXPORTER_OTLP_PROTOCOL

  const signalPath = `/v1/${signal}`
  const endpointEnv =
    process.env[`OTEL_EXPORTER_OTLP_${signal.toUpperCase()}_ENDPOINT`] ??
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT
  if (endpointEnv) {
    const endpoint = endpointEnv.endsWith(signalPath)
      ? endpointEnv
      : `${endpointEnv}${signalPath}`
    envExporter.endpoint = endpoint
  }

  const exportersFromConfig = config?.exporters?.[signal]
  const exporters: TelemetryExporterConfig[] = []

  const otlpConfig = config?.exporters?.otlp

  if (exportersFromConfig) {
    const configExporters = Array.isArray(exportersFromConfig)
      ? exportersFromConfig
      : [exportersFromConfig]

    // Only use otlp as fallback if it's a single config
    // If otlp is an array, it's meant to be used directly, not as fallback
    const otlpFallback = Array.isArray(otlpConfig) ? otlpConfig[0] : otlpConfig

    for (const configExporter of configExporters) {
      const merged: TelemetryExporterConfig = {
        headers: { ...envExporter.headers, ...configExporter.headers },
        timeout: configExporter.timeout ?? envExporter.timeout,
        compression: configExporter.compression ?? envExporter.compression,
        protocol: configExporter.protocol,
        endpoint: configExporter.endpoint ?? otlpFallback?.endpoint,
      }

      if (!merged.protocol) {
        merged.protocol = resolveProtocol(merged.endpoint || '', protocolEnv)
      }

      exporters.push(merged)
    }
  } else if (otlpConfig) {
    const otlpConfigs = Array.isArray(otlpConfig) ? otlpConfig : [otlpConfig]

    for (const otlpExporter of otlpConfigs) {
      const merged: TelemetryExporterConfig = {
        headers: { ...envExporter.headers, ...(otlpExporter?.headers ?? {}) },
        timeout: otlpExporter?.timeout ?? envExporter.timeout,
        compression: otlpExporter?.compression ?? envExporter.compression,
        protocol: otlpExporter?.protocol,
        endpoint: otlpExporter?.endpoint
          ? `${otlpExporter.endpoint}${signalPath}`
          : envExporter.endpoint,
      }

      if (!merged.protocol) {
        merged.protocol = resolveProtocol(merged.endpoint || '', protocolEnv)
      }

      exporters.push(merged)
    }
  }

  return exporters
}

export function initOpenTelemetry(
  config?: TelemetryConfig,
): TelemetryInitResult {
  if (config?.diagnosticLogLevel === 'debug') {
    diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.ALL)
  } else if (
    config?.diagnosticLogLevel !== 'none' &&
    process.env.OTEL_DIAGNOSTIC_LOG_LEVEL
  ) {
    diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.ALL)
  }

  const environment =
    config?.environment ?? process.env.NODE_ENV ?? 'development'
  const release =
    config?.sentry?.release ?? process.env.npm_package_version ?? 'dev'

  Sentry.init({
    dsn: config?.sentry?.dsn ?? process.env.SENTRY_DSN,
    tracesSampleRate:
      config?.sentry?.tracesSampleRate ??
      (environment === 'production' ? 0.2 : 1.0),
    environment: config?.sentry?.environment ?? environment,
    release,
    // Enable Sentry Logs API (requires SDK 9.41.0+)
    enableLogs: config?.sentry?.enableLogs ?? true,
    integrations: [
      Sentry.rewriteFramesIntegration({
        root: process.cwd(),
        iteratee: (frame) => {
          frame.filename = frame.filename?.replace(/^.*?\/dist\//, 'app:///')
          return frame
        },
      }),
      Sentry.prismaIntegration(),
      // Keep Sentry's HTTP integration for request isolation.
      // When we add custom OTEL http instrumentation later, we should set spans: false
      // to avoid duplicate spans.
      Sentry.httpIntegration(),
    ],

    // We own OpenTelemetry setup.
    skipOpenTelemetrySetup: true,
    // We are ESM-only; we will manage loader hooks ourselves if/when needed.
    registerEsmLoaderHooks: false,
  })

  const shardId = config?.shardId ?? process.env.SHARD_ID
  const resourceAttributes: Attributes = {
    [ATTR_SERVICE_NAME]:
      config?.serviceName ??
      process.env.OTEL_SERVICE_NAME ??
      '@thesharks/discord',
    [ATTR_SERVICE_VERSION]: config?.serviceVersion ?? release,
    [ATTR_DEPLOYMENT_ENVIRONMENT_NAME]: environment,
    'service.namespace': config?.namespace ?? '@thesharks',
    'service.instance.id':
      config?.instanceId ?? shardId ?? process.pid.toString(),
  }

  const resource = resourceFromAttributes(resourceAttributes)
  const tracesConfigs = resolveTransportConfig('traces', config)
  const metricsConfigs = resolveTransportConfig('metrics', config)
  const logsConfigs = resolveTransportConfig('logs', config)

  const hasExporters =
    tracesConfigs.some((c) => c.endpoint) ||
    metricsConfigs.some((c) => c.endpoint) ||
    logsConfigs.some((c) => c.endpoint)

  const exportingEnabled =
    typeof config?.enableExport === 'boolean'
      ? config.enableExport
      : hasExporters

  const sentryClient = Sentry.getClient()
  if (!sentryClient) {
    throw new Error(
      'Sentry client not initialized. Ensure Sentry.init() completed successfully.',
    )
  }

  const spanProcessors: SpanProcessor[] = [new SentrySpanProcessor()]
  for (const exporterConfig of tracesConfigs) {
    if (exporterConfig.endpoint && exportingEnabled) {
      const normalizedEndpoint = normalizeOtlpEndpointUrl(
        exporterConfig.endpoint,
        'traces',
      )
      const traceExporter =
        exporterConfig.protocol === 'grpc'
          ? new OTLPTraceGrpcExporter({
              url: normalizedEndpoint,
              headers: exporterConfig.headers,
              timeoutMillis: exporterConfig.timeout,
              compression:
                exporterConfig.compression === 'gzip'
                  ? CompressionAlgorithm.GZIP
                  : CompressionAlgorithm.NONE,
            })
          : new OTLPTraceHttpExporter({
              url: normalizedEndpoint,
              headers: exporterConfig.headers,
              timeoutMillis: exporterConfig.timeout,
            })
      spanProcessors.push(new BatchSpanProcessor(traceExporter))
    }
  }

  const tracerProvider = new NodeTracerProvider({
    resource,
    sampler: new SentrySampler(sentryClient),
    spanProcessors,
  })

  tracerProvider.register({
    propagator: new SentryPropagator(),
    contextManager: new Sentry.SentryContextManager(),
  })

  const readers: MetricReader[] = []
  for (const exporterConfig of metricsConfigs) {
    if (exporterConfig.endpoint && exportingEnabled) {
      const normalizedEndpoint = normalizeOtlpEndpointUrl(
        exporterConfig.endpoint,
        'metrics',
      )
      const metricExporter =
        exporterConfig.protocol === 'grpc'
          ? new OTLPMetricGrpcExporter({
              url: normalizedEndpoint,
              headers: exporterConfig.headers,
              timeoutMillis: exporterConfig.timeout,
              compression:
                exporterConfig.compression === 'gzip'
                  ? CompressionAlgorithm.GZIP
                  : CompressionAlgorithm.NONE,
            })
          : new OTLPMetricHttpExporter({
              url: normalizedEndpoint,
              headers: exporterConfig.headers,
              timeoutMillis: exporterConfig.timeout,
            })
      readers.push(
        new PeriodicExportingMetricReader({
          exporter: metricExporter,
        }),
      )
    }
  }

  const meterProvider =
    readers.length > 0
      ? new MeterProvider({
          resource,
          readers,
        })
      : new MeterProvider({ resource })

  metrics.setGlobalMeterProvider(meterProvider)

  const logProcessors: LogRecordProcessor[] = []
  for (const exporterConfig of logsConfigs) {
    if (exporterConfig.endpoint && exportingEnabled) {
      const normalizedEndpoint = normalizeOtlpEndpointUrl(
        exporterConfig.endpoint,
        'logs',
      )
      const logExporter =
        exporterConfig.protocol === 'grpc'
          ? new OTLPLogGrpcExporter({
              url: normalizedEndpoint,
              headers: exporterConfig.headers,
              timeoutMillis: exporterConfig.timeout,
              compression:
                exporterConfig.compression === 'gzip'
                  ? CompressionAlgorithm.GZIP
                  : CompressionAlgorithm.NONE,
            })
          : new OTLPLogHttpExporter({
              url: normalizedEndpoint,
              headers: exporterConfig.headers,
              timeoutMillis: exporterConfig.timeout,
            })
      logProcessors.push(new BatchLogRecordProcessor(logExporter))
    }
  }

  const loggerProvider =
    logProcessors.length > 0
      ? new LoggerProvider({
          resource,
          processors: logProcessors,
        })
      : new LoggerProvider({ resource })

  logs.setGlobalLoggerProvider(loggerProvider)

  const pgEnabled = resolveInstrumentationSetting(
    config?.instrumentations?.pg,
    process.env.OTEL_INSTRUMENTATION_PG_ENABLED,
    true,
  )
  const undiciEnabled = resolveInstrumentationSetting(
    config?.instrumentations?.undici,
    process.env.OTEL_INSTRUMENTATION_UNDICI_ENABLED,
    true,
  )
  const ioredisEnabled = resolveInstrumentationSetting(
    config?.instrumentations?.ioredis,
    process.env.OTEL_INSTRUMENTATION_IOREDIS_ENABLED,
    true,
  )
  const fsEnabled = resolveInstrumentationSetting(
    config?.instrumentations?.fs,
    process.env.OTEL_INSTRUMENTATION_FS_ENABLED,
    false,
  )

  registerInstrumentations({
    instrumentations: [
      ...(pgEnabled ? [new PgInstrumentation()] : []),
      ...(undiciEnabled ? [new UndiciInstrumentation()] : []),
      ...(ioredisEnabled ? [new IORedisInstrumentation()] : []),
      ...(fsEnabled ? [new FsInstrumentation()] : []),
    ],
  })

  // Validate that the setup is correct (dev-only by default)
  if (process.env.SENTRY_VALIDATE_OTEL_SETUP === 'true') {
    Sentry.validateOpenTelemetrySetup()
  }

  async function shutdown(): Promise<void> {
    try {
      await loggerProvider.shutdown()
    } finally {
      try {
        await meterProvider.shutdown()
      } finally {
        try {
          await tracerProvider.shutdown()
        } finally {
          await Sentry.flush(2_000)
        }
      }
    }
  }

  return { shutdown }
}
