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
import { RuntimeNodeInstrumentation } from '@opentelemetry/instrumentation-runtime-node'
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
import { eventLoopBlockIntegration } from '@sentry/node-native'
import {
  SentryPropagator,
  SentrySampler,
  SentrySpanProcessor,
} from '@sentry/opentelemetry'
import { nodeProfilingIntegration } from '@sentry/profiling-node'
import type { TelemetryConfig, TelemetryExporterConfig } from './types.js'

// from @opentelemetry/semantic-conventions/incubating
// recommendation is to copy relevant definitions into code base
const ATTR_DEPLOYMENT_ENVIRONMENT_NAME = 'deployment.environment.name'

export interface TelemetryInitResult {
  shutdown(): Promise<void>
}

export function normalizeOtlpEndpointUrl(
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

function parseDiagLogLevel(
  value: string | undefined,
): DiagLogLevel | undefined {
  switch (value?.trim().toLowerCase()) {
    case 'none':
      return DiagLogLevel.NONE
    case 'error':
      return DiagLogLevel.ERROR
    case 'warn':
      return DiagLogLevel.WARN
    case 'info':
      return DiagLogLevel.INFO
    case 'debug':
      return DiagLogLevel.DEBUG
    case 'verbose':
      return DiagLogLevel.VERBOSE
    case 'all':
      return DiagLogLevel.ALL
    default:
      return undefined
  }
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

function withSignalPath(
  endpoint: string,
  signalPath: string,
  protocol: 'http' | 'grpc',
): string {
  // gRPC OTLP endpoints are host:port only; per-signal paths apply to http/protobuf.
  if (protocol === 'grpc') {
    return endpoint
  }
  if (endpoint.endsWith(signalPath) || endpoint.endsWith(`${signalPath}/`)) {
    return endpoint
  }
  return `${endpoint.replace(/\/+$/, '')}${signalPath}`
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

export function resolveTransportConfig(
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
  const signalEndpointEnv =
    process.env[`OTEL_EXPORTER_OTLP_${signal.toUpperCase()}_ENDPOINT`]
  const globalEndpointEnv = process.env.OTEL_EXPORTER_OTLP_ENDPOINT
  if (signalEndpointEnv) {
    // Signal-specific endpoints are used verbatim per the OTLP spec.
    envExporter.endpoint = signalEndpointEnv
  } else if (globalEndpointEnv) {
    envExporter.endpoint = withSignalPath(
      globalEndpointEnv,
      signalPath,
      resolveProtocol(globalEndpointEnv, protocolEnv),
    )
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
      const protocol =
        configExporter.protocol ??
        resolveProtocol(
          configExporter.endpoint ??
            otlpFallback?.endpoint ??
            envExporter.endpoint ??
            '',
          protocolEnv,
        )
      // Explicit per-signal endpoints are used verbatim; the shared otlp
      // endpoint needs the signal path appended.
      const endpoint =
        configExporter.endpoint ??
        (otlpFallback?.endpoint
          ? withSignalPath(otlpFallback.endpoint, signalPath, protocol)
          : envExporter.endpoint)
      const merged: TelemetryExporterConfig = {
        headers: { ...envExporter.headers, ...configExporter.headers },
        timeout: configExporter.timeout ?? envExporter.timeout,
        compression: configExporter.compression ?? envExporter.compression,
        protocol,
        endpoint,
      }

      if (!merged.endpoint) {
        diag.warn(
          `Exporter configuration missing endpoint, skipping: ${signal}`,
        )
        continue
      }

      exporters.push(merged)
    }
  } else if (otlpConfig) {
    const otlpConfigs = Array.isArray(otlpConfig) ? otlpConfig : [otlpConfig]

    for (const otlpExporter of otlpConfigs) {
      const protocol =
        otlpExporter?.protocol ??
        resolveProtocol(
          otlpExporter?.endpoint ?? envExporter.endpoint ?? '',
          protocolEnv,
        )
      const merged: TelemetryExporterConfig = {
        headers: { ...envExporter.headers, ...(otlpExporter?.headers ?? {}) },
        timeout: otlpExporter?.timeout ?? envExporter.timeout,
        compression: otlpExporter?.compression ?? envExporter.compression,
        protocol,
        endpoint: otlpExporter?.endpoint
          ? withSignalPath(otlpExporter.endpoint, signalPath, protocol)
          : envExporter.endpoint,
      }

      if (!merged.endpoint) {
        diag.warn(
          `Exporter configuration missing endpoint, skipping: ${signal}`,
        )
        continue
      }

      exporters.push(merged)
    }
  } else if (envExporter.endpoint) {
    exporters.push({
      ...envExporter,
      protocol: resolveProtocol(envExporter.endpoint, protocolEnv),
    })
  }

  return exporters
}

function buildOtlpOptions(
  signal: 'traces' | 'metrics' | 'logs',
  exporterConfig: TelemetryExporterConfig,
) {
  const normalizedEndpoint = exporterConfig.endpoint
    ? normalizeOtlpEndpointUrl(exporterConfig.endpoint, signal)
    : undefined
  return {
    ...(normalizedEndpoint ? { url: normalizedEndpoint } : {}),
    headers: exporterConfig.headers,
    timeoutMillis: exporterConfig.timeout,
    compression:
      exporterConfig.compression === 'gzip'
        ? CompressionAlgorithm.GZIP
        : CompressionAlgorithm.NONE,
  }
}

export function initOpenTelemetry(
  config?: TelemetryConfig,
): TelemetryInitResult {
  if (config?.diagnosticLogLevel === 'debug') {
    diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.ALL)
  } else if (config?.diagnosticLogLevel !== 'none') {
    const envLevel = parseDiagLogLevel(process.env.OTEL_DIAGNOSTIC_LOG_LEVEL)
    if (envLevel !== undefined && envLevel !== DiagLogLevel.NONE) {
      diag.setLogger(new DiagConsoleLogger(), envLevel)
    }
  }

  const environment =
    config?.environment ?? process.env.NODE_ENV ?? 'development'
  const release =
    config?.sentry?.release ?? process.env.npm_package_version ?? 'dev'

  const profileSessionSampleRate = config?.sentry?.profileSessionSampleRate ?? 0
  const eventLoopBlockThreshold =
    config?.sentry?.eventLoopBlockThreshold ?? 1_000

  Sentry.init({
    dsn: config?.sentry?.dsn ?? process.env.SENTRY_DSN,
    tracesSampleRate:
      config?.sentry?.tracesSampleRate ??
      (environment === 'production' ? 0.2 : 1.0),
    // Takes precedence over tracesSampleRate when provided.
    tracesSampler: config?.sentry?.tracesSampler,
    environment: config?.sentry?.environment ?? environment,
    release,
    // Enable Sentry Logs API (requires SDK 9.41.0+)
    enableLogs: config?.sentry?.enableLogs ?? true,
    enableMetrics: config?.sentry?.enableMetrics ?? true,
    // Capture local variables in exception stack frames.
    includeLocalVariables: config?.sentry?.includeLocalVariables ?? true,
    // Nothing downstream continues our traces, and tagscript {fetch:} can
    // reach arbitrary hosts that must not see sentry-trace/baggage headers.
    tracePropagationTargets: config?.sentry?.tracePropagationTargets ?? [],
    spotlight:
      config?.sentry?.spotlight ?? process.env.SENTRY_SPOTLIGHT === 'true',
    ...(config?.sentry?.tags
      ? { initialScope: { tags: config.sentry.tags } }
      : {}),
    // Continuous profiling: profile chunks are collected while a sampled
    // trace is active on this thread.
    profileSessionSampleRate,
    profileLifecycle: 'trace',
    integrations: [
      Sentry.rewriteFramesIntegration({
        root: process.cwd(),
        iteratee: (frame) => {
          frame.filename = frame.filename?.replace(/^.*?\/dist\//, 'app:///')
          return frame
        },
      }),
      // Keep Sentry's HTTP integration for request isolation. Under
      // skipOpenTelemetrySetup it emits no spans, so it doesn't duplicate
      // our undici instrumentation.
      Sentry.httpIntegration(),
      // Flattens ZodError issues into readable event context.
      Sentry.zodErrorsIntegration(),
      // Buffers feature flag evaluations (reported via addFeatureFlag by
      // the app's OpenFeature hook) and attaches them to error events.
      Sentry.featureFlagsIntegration(),
      // Captures non-standard error properties (discord.js errors carry
      // code/status/method/url) as event context.
      Sentry.extraErrorDataIntegration(),
      // Event loop, GC and memory metrics via the Sentry metrics product.
      Sentry.nodeRuntimeMetricsIntegration(),
      ...(profileSessionSampleRate > 0 ? [nodeProfilingIntegration()] : []),
      ...(eventLoopBlockThreshold !== false
        ? [eventLoopBlockIntegration({ threshold: eventLoopBlockThreshold })]
        : []),
    ],

    // We own OpenTelemetry setup.
    skipOpenTelemetrySetup: true,
    // We are ESM-only; we will manage loader hooks ourselves if/when needed.
    registerEsmLoaderHooks: false,
  })

  const shardId = config?.shardId ?? process.env.SHARD_ID
  const resourceAttributes: Attributes = {
    ...config?.resourceAttributes,
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

  // enableExport: true without any configured endpoint falls back to the
  // exporter libraries' default endpoints (localhost).
  if (config?.enableExport === true) {
    if (tracesConfigs.length === 0) tracesConfigs.push({})
    if (metricsConfigs.length === 0) metricsConfigs.push({})
    if (logsConfigs.length === 0) logsConfigs.push({})
  }

  const sentryClient = Sentry.getClient()
  if (!sentryClient) {
    throw new Error(
      'Sentry client not initialized. Ensure Sentry.init() completed successfully.',
    )
  }

  const spanProcessors: SpanProcessor[] = [new SentrySpanProcessor()]
  for (const exporterConfig of tracesConfigs) {
    if (exportingEnabled) {
      const options = buildOtlpOptions('traces', exporterConfig)
      const traceExporter =
        exporterConfig.protocol === 'grpc'
          ? new OTLPTraceGrpcExporter(options)
          : new OTLPTraceHttpExporter(options)
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
    if (exportingEnabled) {
      const options = buildOtlpOptions('metrics', exporterConfig)
      const metricExporter =
        exporterConfig.protocol === 'grpc'
          ? new OTLPMetricGrpcExporter(options)
          : new OTLPMetricHttpExporter(options)
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
    if (exportingEnabled) {
      const options = buildOtlpOptions('logs', exporterConfig)
      const logExporter =
        exporterConfig.protocol === 'grpc'
          ? new OTLPLogGrpcExporter(options)
          : new OTLPLogHttpExporter(options)
      logProcessors.push(new BatchLogRecordProcessor({ exporter: logExporter }))
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
  const runtimeNodeEnabled = resolveInstrumentationSetting(
    config?.instrumentations?.runtimeNode,
    process.env.OTEL_INSTRUMENTATION_RUNTIME_NODE_ENABLED,
    true,
  )

  registerInstrumentations({
    instrumentations: [
      ...(pgEnabled ? [new PgInstrumentation()] : []),
      ...(undiciEnabled ? [new UndiciInstrumentation()] : []),
      ...(ioredisEnabled ? [new IORedisInstrumentation()] : []),
      ...(fsEnabled ? [new FsInstrumentation()] : []),
      ...(runtimeNodeEnabled ? [new RuntimeNodeInstrumentation()] : []),
    ],
  })

  // Validate that the setup is correct (dev-only by default)
  if (process.env.SENTRY_VALIDATE_OTEL_SETUP === 'true') {
    Sentry.validateOpenTelemetrySetup()
  }

  async function shutdown(): Promise<void> {
    // Bound the flush so a slow or unreachable collector can't eat the
    // process supervisor's termination grace period (exporters retry with
    // backoff, which we observed taking 15s+ against a dead endpoint).
    const timeoutMillis = config?.shutdownTimeoutMillis ?? 10_000

    const work = (async () => {
      try {
        await loggerProvider.shutdown()
      } finally {
        try {
          await meterProvider.shutdown()
        } finally {
          await tracerProvider.shutdown()
        }
      }
    })()

    try {
      await promiseWithDeadline(work, timeoutMillis, 'OpenTelemetry shutdown')
    } catch (error) {
      diag.error('OpenTelemetry shutdown failed', error)
    }

    try {
      // Sentry.flush applies its own timeout.
      await Sentry.flush(2_000)
    } catch (error) {
      diag.error('Sentry flush failed', error)
    }
  }

  return { shutdown }
}

async function promiseWithDeadline(
  work: Promise<void>,
  timeoutMillis: number,
  what: string,
): Promise<void> {
  let timer: NodeJS.Timeout | undefined
  const deadline = new Promise<'timeout'>((resolve) => {
    timer = setTimeout(() => resolve('timeout'), timeoutMillis)
  })

  try {
    const result = await Promise.race([work, deadline])
    if (result === 'timeout') {
      diag.warn(`${what} did not finish within ${timeoutMillis}ms; abandoning`)
      // Detach the abandoned work so a late rejection can't become an
      // unhandled rejection after we've moved on.
      work.catch(() => undefined)
    }
  } finally {
    clearTimeout(timer)
  }
}
