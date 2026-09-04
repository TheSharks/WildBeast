import {
  type Attributes,
  type Context,
  context,
  DiagConsoleLogger,
  DiagLogLevel,
  diag,
  metrics,
  propagation,
  type TextMapGetter,
  type TextMapPropagator,
  type TextMapSetter,
  trace,
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

/**
 * Keys that must never leave the process in Sentry events or OTEL logs.
 * Discord usernames/tags, guild/channel names and secrets are PII: telemetry
 * stays id-only unless explicitly opted in.
 */
export const SENTRY_PII_DENYLIST = [
  'username',
  'tag',
  'globalName',
  'displayName',
  'email',
  'token',
  'authorization',
  'password',
  'secret',
  'guild_name',
  'channel_name',
  'name',
] as const

function isDenylistedKey(key: string): boolean {
  const lower = key.toLowerCase()
  return (SENTRY_PII_DENYLIST as readonly string[]).some(
    (denied) => lower === denied || lower.endsWith(`_${denied}`),
  )
}

function scrubValue(value: unknown, key?: string): unknown {
  if (key && isDenylistedKey(key)) {
    return '[Redacted]'
  }
  if (Array.isArray(value)) {
    return value.map((entry) => scrubValue(entry))
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = scrubValue(v, k)
    }
    return out
  }
  if (typeof value === 'string' && key === undefined) {
    // Best-effort token redaction in free-form strings (bot tokens, bearer).
    return value
      .replace(
        /[A-Za-z0-9_-]{24}\.[A-Za-z0-9_-]{6}\.[A-Za-z0-9_-]{27}/g,
        '[Redacted]',
      )
      .replace(/Bearer\s+[A-Za-z0-9._~-]+/gi, 'Bearer [Redacted]')
  }
  return value
}

/**
 * Sentry `beforeSend` scrub: id-only by default. Drops denylisted keys from
 * user, contexts, extra and breadcrumb data. Exported for tests.
 */
export function scrubSentryEvent<T>(event: T): T {
  if (!event || typeof event !== 'object') return event
  const record = event as Record<string, unknown>

  if (record.user && typeof record.user === 'object') {
    const user = record.user as Record<string, unknown>
    const scrubbed: Record<string, unknown> = {}
    if (typeof user.id === 'string') scrubbed.id = user.id
    // Preserve an explicitly opted-in username only when the caller set it
    // via includePII; otherwise drop it (id-only default).
    record.user = scrubbed
  }

  if (record.contexts && typeof record.contexts === 'object') {
    const contexts = record.contexts as Record<string, unknown>
    for (const [ctxKey, ctxValue] of Object.entries(contexts)) {
      if (ctxValue && typeof ctxValue === 'object') {
        const scrubbed: Record<string, unknown> = {}
        for (const [k, v] of Object.entries(
          ctxValue as Record<string, unknown>,
        )) {
          if (isDenylistedKey(k)) {
            scrubbed[k] = '[Redacted]'
          } else {
            scrubbed[k] = scrubValue(v, k)
          }
        }
        // Guild/channel contexts stay id-only: drop redacted name markers
        // entirely so no high-cardinality label survives.
        if (ctxKey === 'guild' || ctxKey === 'channel') {
          delete scrubbed.name
        }
        contexts[ctxKey] = scrubbed
      }
    }
  }

  if (record.extra && typeof record.extra === 'object') {
    record.extra = scrubValue(record.extra) as Record<string, unknown>
  }

  if (Array.isArray(record.breadcrumbs)) {
    record.breadcrumbs = (record.breadcrumbs as unknown[]).map((crumb) => {
      if (crumb && typeof crumb === 'object') {
        const c = crumb as Record<string, unknown>
        if (c.data && typeof c.data === 'object') {
          return { ...c, data: scrubValue(c.data) }
        }
      }
      return crumb
    })
  }

  return event
}

// --- Minimal W3C propagators (vendored to avoid a new @opentelemetry/core
// dependency). Together with SentryPropagator they form the composite
// propagator below: W3C traceparent/baggage for OTLP collectors plus
// sentry-trace/baggage for Sentry.

const TRACE_PARENT_HEADER = 'traceparent'
const TRACE_STATE_HEADER = 'tracestate'
const BAGGAGE_HEADER = 'baggage'

function parseTraceParent(value: string | undefined) {
  if (!value) return undefined
  const parts = value.trim().split('-')
  if (parts.length < 4) return undefined
  const [version, traceId, spanId, flags] = parts
  if (!/^[0-9a-f]{2}$/.test(version ?? '')) return undefined
  if (!/^[0-9a-f]{32}$/.test(traceId ?? '')) return undefined
  if (!/^[0-9a-f]{16}$/.test(spanId ?? '')) return undefined
  if (!/^[0-9a-f]{2}$/.test(flags ?? '')) return undefined
  return { traceId: traceId as string, spanId: spanId as string, flags }
}

/** W3C Trace Context propagator (traceparent/tracestate). */
export class W3CTraceContextPropagator implements TextMapPropagator {
  inject(ctx: Context, carrier: unknown, setter: TextMapSetter): void {
    const spanContext = trace.getSpanContext(ctx)
    if (!spanContext) return
    const flags = spanContext.traceFlags & 1 ? '01' : '00'
    setter.set(
      carrier as Record<string, string>,
      TRACE_PARENT_HEADER,
      `00-${spanContext.traceId}-${spanContext.spanId}-${flags}`,
    )
  }

  extract(ctx: Context, carrier: unknown, getter: TextMapGetter): Context {
    const header = getter.get(
      carrier as Record<string, string>,
      TRACE_PARENT_HEADER,
    )
    const value = Array.isArray(header) ? header[0] : header
    const parsed = parseTraceParent(
      typeof value === 'string' ? value : undefined,
    )
    if (!parsed) return ctx
    return trace.setSpanContext(ctx, {
      traceId: parsed.traceId,
      spanId: parsed.spanId,
      traceFlags: parsed.flags === '01' ? 1 : 0,
      isRemote: true,
    })
  }

  fields(): string[] {
    return [TRACE_PARENT_HEADER, TRACE_STATE_HEADER]
  }
}

/** W3C Baggage propagator (minimal pass-through). */
export class W3CBaggagePropagator implements TextMapPropagator {
  inject(ctx: Context, carrier: unknown, setter: TextMapSetter): void {
    const baggage = propagation.getBaggage(ctx)
    if (!baggage?.getAllEntries) return
    const header = (baggage.getAllEntries() ?? [])
      .map(([k, v]) => `${k}=${encodeURIComponent(String(v.value))}`)
      .join(', ')
    if (header) {
      setter.set(carrier as Record<string, string>, BAGGAGE_HEADER, header)
    }
  }

  extract(ctx: Context, carrier: unknown, getter: TextMapGetter): Context {
    const header = getter.get(carrier as Record<string, string>, BAGGAGE_HEADER)
    const value = Array.isArray(header) ? header.join(',') : header
    if (typeof value !== 'string' || !value) return ctx
    try {
      const entries: Record<string, { value: string }> = {}
      for (const part of value.split(',')) {
        const eq = part.indexOf('=')
        if (eq === -1) continue
        const key = part.slice(0, eq).trim()
        const val = decodeURIComponent(part.slice(eq + 1).trim())
        if (key) entries[key] = { value: val }
      }
      if (Object.keys(entries).length === 0) return ctx
      return propagation.setBaggage(ctx, propagation.createBaggage(entries))
    } catch {
      return ctx
    }
  }

  fields(): string[] {
    return [BAGGAGE_HEADER]
  }
}

/** Fan-out propagator: injects/extracts via every member (W3C + Sentry). */
export class CompositePropagator implements TextMapPropagator {
  private readonly propagators: TextMapPropagator[]

  constructor(config: { propagators: TextMapPropagator[] }) {
    this.propagators = config.propagators
  }

  inject(ctx: Context, carrier: unknown, setter: TextMapSetter): void {
    for (const propagator of this.propagators) {
      try {
        propagator.inject(ctx, carrier, setter)
      } catch {
        // One propagator must not break the others.
      }
    }
  }

  extract(ctx: Context, carrier: unknown, getter: TextMapGetter): Context {
    let next = ctx
    for (const propagator of this.propagators) {
      try {
        next = propagator.extract(next, carrier, getter)
      } catch {
        // ignore and continue with the next propagator
      }
    }
    return next
  }

  fields(): string[] {
    return [...new Set(this.propagators.flatMap((p) => p.fields()))]
  }
}

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
  // Published images bake SENTRY_RELEASE in at build time; npm scripts
  // expose the package version; a bare `node dist/...` falls back to the
  // commit when the image build provided one. || rather than ?? because
  // Dockerfile ARGs surface as empty strings when unset.
  const release =
    config?.sentry?.release ??
    (process.env.SENTRY_RELEASE ||
      process.env.npm_package_version ||
      process.env.GIT_COMMIT ||
      'dev')

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
    // Id-only by default: scrub usernames, guild/channel names and secrets
    // from every error event. Composes with a caller-provided beforeSend.
    beforeSend: (event, hint) => {
      const scrubbed = scrubSentryEvent(event)
      const custom = config?.sentry?.beforeSend
      return typeof custom === 'function'
        ? (custom as (e: typeof event, h: typeof hint) => typeof event | null)(
            scrubbed,
            hint,
          )
        : scrubbed
    },
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

  // enableExport: true requires an explicit endpoint. Silently falling back
  // to the exporter libraries' localhost defaults would black-hole telemetry
  // in production, so warn loudly and export nothing until one is set.
  if (config?.enableExport === true && !hasExporters) {
    const message =
      '[telemetry] enableExport is true but no OTLP endpoint is configured ' +
      '(OTEL_EXPORTER_OTLP_*_ENDPOINT or exporters.otlp/traces/metrics/logs). ' +
      'Exporting is disabled until an endpoint is set.'
    try {
      diag.warn(message)
    } catch {
      // ignore
    }
    console.warn(message)
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
    // W3C traceparent/baggage for OTLP collectors plus sentry-trace/baggage
    // for Sentry. Outgoing Sentry headers are still gated by
    // tracePropagationTargets (default []).
    propagator: new CompositePropagator({
      propagators: [
        new W3CTraceContextPropagator(),
        new W3CBaggagePropagator(),
        new SentryPropagator(),
      ],
    }),
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
    // One registration per process: the SDK dedupes by instrumentation name,
    // so repeated initOpenTelemetry calls (tests) must disable
    // instrumentations they don't own to avoid re-patching modules.
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
