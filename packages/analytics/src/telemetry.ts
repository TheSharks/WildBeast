import {
  type Attributes,
  DiagConsoleLogger,
  DiagLogLevel,
  diag,
  metrics,
} from '@opentelemetry/api'
import { logs } from '@opentelemetry/api-logs'
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http'
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { registerInstrumentations } from '@opentelemetry/instrumentation'
import { FsInstrumentation } from '@opentelemetry/instrumentation-fs'
import { IORedisInstrumentation } from '@opentelemetry/instrumentation-ioredis'
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg'
import { UndiciInstrumentation } from '@opentelemetry/instrumentation-undici'
import { resourceFromAttributes } from '@opentelemetry/resources'
import {
  BatchLogRecordProcessor,
  LoggerProvider,
} from '@opentelemetry/sdk-logs'
import {
  MeterProvider,
  PeriodicExportingMetricReader,
} from '@opentelemetry/sdk-metrics'
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base'
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
import type { TelemetryConfig } from './types.js'

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

function shouldExportOtlp(
  config: TelemetryConfig | undefined,
  endpoints: Array<string | undefined>,
): boolean {
  if (typeof config?.enableExport === 'boolean') {
    return config.enableExport
  }

  return endpoints.some((endpoint) => Boolean(endpoint))
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
  const tracesEndpointRaw = () => {
    if (config?.exporters?.traces?.endpoint) {
      return config.exporters.traces.endpoint
    }
    if (config?.exporters?.otlp?.endpoint) {
      return `${config.exporters.otlp.endpoint}/v1/traces`
    }
    if (process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT) {
      return process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT
    }
    if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
      return `${process.env.OTEL_EXPORTER_OTLP_ENDPOINT}/v1/traces`
    }
    return ''
  }
  const metricsEndpointRaw = () => {
    if (config?.exporters?.metrics?.endpoint) {
      return config.exporters.metrics.endpoint
    }
    if (config?.exporters?.otlp?.endpoint) {
      return `${config.exporters.otlp.endpoint}/v1/metrics`
    }
    if (process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT) {
      return process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT
    }
    if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
      return `${process.env.OTEL_EXPORTER_OTLP_ENDPOINT}/v1/metrics`
    }
    return ''
  }
  const logsEndpointRaw = () => {
    if (config?.exporters?.logs?.endpoint) {
      return config.exporters.logs.endpoint
    }
    if (config?.exporters?.otlp?.endpoint) {
      return `${config.exporters.otlp.endpoint}/v1/logs`
    }
    if (process.env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT) {
      return process.env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT
    }
    if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
      return `${process.env.OTEL_EXPORTER_OTLP_ENDPOINT}/v1/logs`
    }
    return ''
  }
  const exportingEnabled = shouldExportOtlp(config, [
    tracesEndpointRaw(),
    metricsEndpointRaw(),
    logsEndpointRaw(),
  ])

  const tracesEndpoint = tracesEndpointRaw()
    ? normalizeOtlpEndpointUrl(tracesEndpointRaw(), 'traces')
    : undefined
  const metricsEndpoint = metricsEndpointRaw()
    ? normalizeOtlpEndpointUrl(metricsEndpointRaw(), 'metrics')
    : undefined
  const logsEndpoint = logsEndpointRaw()
    ? normalizeOtlpEndpointUrl(logsEndpointRaw(), 'logs')
    : undefined

  const otlpHeaders = config?.exporters?.otlp?.headers
  const tracesHeaders = {
    ...otlpHeaders,
    ...config?.exporters?.traces?.headers,
  }
  const metricsHeaders = {
    ...otlpHeaders,
    ...config?.exporters?.metrics?.headers,
  }
  const logsHeaders = {
    ...otlpHeaders,
    ...config?.exporters?.logs?.headers,
  }

  const sentryClient = Sentry.getClient()
  if (!sentryClient) {
    throw new Error(
      'Sentry client not initialized. Ensure Sentry.init() completed successfully.',
    )
  }

  const tracerProvider = new NodeTracerProvider({
    resource,
    // SentrySampler expects a Sentry client; initOpenTelemetry always runs after Sentry.init
    sampler: new SentrySampler(sentryClient),
    spanProcessors: exportingEnabled
      ? [
          new SentrySpanProcessor(),
          new BatchSpanProcessor(
            new OTLPTraceExporter({
              url: tracesEndpoint,
              headers: tracesHeaders,
            }),
          ),
        ]
      : [new SentrySpanProcessor()],
  })

  tracerProvider.register({
    propagator: new SentryPropagator(),
    contextManager: new Sentry.SentryContextManager(),
  })

  const meterProvider = exportingEnabled
    ? new MeterProvider({
        resource,
        readers: [
          new PeriodicExportingMetricReader({
            exporter: new OTLPMetricExporter({
              url: metricsEndpoint,
              headers: metricsHeaders,
            }),
          }),
        ],
      })
    : new MeterProvider({ resource })

  metrics.setGlobalMeterProvider(meterProvider)

  const loggerProvider = exportingEnabled
    ? new LoggerProvider({
        resource,
        processors: [
          new BatchLogRecordProcessor(
            new OTLPLogExporter({
              url: logsEndpoint,
              headers: logsHeaders,
            }),
          ),
        ],
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
