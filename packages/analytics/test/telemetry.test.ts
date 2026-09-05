import type { Span } from '@opentelemetry/api'
import { snapshotEnv } from '@thesharks/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CompositePropagator,
  isInternalTraceTarget,
  normalizeOtlpEndpointUrl,
  resolveTransportConfig,
  SENTRY_PII_DENYLIST,
  scrubSentryEvent,
  W3CBaggagePropagator,
  W3CTraceContextPropagator,
} from '../src/telemetry.js'

let restoreEnv: () => void

beforeEach(() => {
  restoreEnv = snapshotEnv(['OTEL_'])
})

afterEach(() => {
  restoreEnv()
})

describe('resolveTransportConfig', () => {
  it('returns no exporters without config or environment', () => {
    expect(resolveTransportConfig('traces')).toEqual([])
    expect(resolveTransportConfig('metrics')).toEqual([])
    expect(resolveTransportConfig('logs')).toEqual([])
  })

  it('creates an exporter from the global env endpoint with the signal path appended', () => {
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = 'http://collector:4318'

    const traces = resolveTransportConfig('traces')
    expect(traces).toHaveLength(1)
    expect(traces[0].endpoint).toBe('http://collector:4318/v1/traces')
    expect(traces[0].protocol).toBe('http')

    const metrics = resolveTransportConfig('metrics')
    expect(metrics[0].endpoint).toBe('http://collector:4318/v1/metrics')

    const logs = resolveTransportConfig('logs')
    expect(logs[0].endpoint).toBe('http://collector:4318/v1/logs')
  })

  it('does not double-append the signal path to the global env endpoint', () => {
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = 'http://collector:4318/v1/traces'

    const traces = resolveTransportConfig('traces')
    expect(traces[0].endpoint).toBe('http://collector:4318/v1/traces')
  })

  it('strips trailing slashes before appending the signal path', () => {
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = 'http://collector:4318/'

    const traces = resolveTransportConfig('traces')
    expect(traces[0].endpoint).toBe('http://collector:4318/v1/traces')
  })

  it('uses signal-specific env endpoints verbatim per the OTLP spec', () => {
    process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT =
      'http://collector:4318/custom/path'

    const traces = resolveTransportConfig('traces')
    expect(traces[0].endpoint).toBe('http://collector:4318/custom/path')
  })

  it('prefers the signal-specific env endpoint over the global one', () => {
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = 'http://global:4318'
    process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT =
      'http://traces:4318/v1/traces'

    const traces = resolveTransportConfig('traces')
    expect(traces[0].endpoint).toBe('http://traces:4318/v1/traces')

    const metrics = resolveTransportConfig('metrics')
    expect(metrics[0].endpoint).toBe('http://global:4318/v1/metrics')
  })

  it('does not append a signal path when the protocol is grpc', () => {
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = 'http://collector:4317'
    process.env.OTEL_EXPORTER_OTLP_PROTOCOL = 'grpc'

    const traces = resolveTransportConfig('traces')
    expect(traces[0].endpoint).toBe('http://collector:4317')
    expect(traces[0].protocol).toBe('grpc')
  })

  it('detects grpc from the endpoint scheme', () => {
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = 'grpc://collector:4317'

    const traces = resolveTransportConfig('traces')
    expect(traces[0].endpoint).toBe('grpc://collector:4317')
    expect(traces[0].protocol).toBe('grpc')
  })

  it('honors signal-specific protocol env over the global one', () => {
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = 'http://collector:4318'
    process.env.OTEL_EXPORTER_OTLP_PROTOCOL = 'http/protobuf'
    process.env.OTEL_EXPORTER_OTLP_TRACES_PROTOCOL = 'grpc'

    const traces = resolveTransportConfig('traces')
    expect(traces[0].protocol).toBe('grpc')

    const metrics = resolveTransportConfig('metrics')
    expect(metrics[0].protocol).toBe('http')
  })

  it('appends the signal path to a shared otlp config endpoint exactly once', () => {
    const config = {
      exporters: { otlp: { endpoint: 'http://collector:4318' } },
    }

    const traces = resolveTransportConfig('traces', config)
    expect(traces[0].endpoint).toBe('http://collector:4318/v1/traces')

    const alreadySuffixed = {
      exporters: { otlp: { endpoint: 'http://collector:4318/v1/traces' } },
    }
    expect(resolveTransportConfig('traces', alreadySuffixed)[0].endpoint).toBe(
      'http://collector:4318/v1/traces',
    )
  })

  it('uses per-signal config endpoints verbatim and falls back to otlp with the path appended', () => {
    const config = {
      exporters: {
        otlp: { endpoint: 'http://shared:4318' },
        traces: { endpoint: 'http://traces:4318/custom' },
        metrics: {},
      },
    }

    const traces = resolveTransportConfig('traces', config)
    expect(traces[0].endpoint).toBe('http://traces:4318/custom')

    const metrics = resolveTransportConfig('metrics', config)
    expect(metrics[0].endpoint).toBe('http://shared:4318/v1/metrics')
  })

  it('supports multiple exporters per signal', () => {
    const config = {
      exporters: {
        traces: [
          { endpoint: 'http://primary:4318/v1/traces' },
          { endpoint: 'http://secondary:4318/v1/traces' },
        ],
      },
    }

    const traces = resolveTransportConfig('traces', config)
    expect(traces).toHaveLength(2)
    expect(traces[0].endpoint).toBe('http://primary:4318/v1/traces')
    expect(traces[1].endpoint).toBe('http://secondary:4318/v1/traces')
  })

  it('skips exporter entries without any endpoint', () => {
    const config = {
      exporters: { traces: [{ headers: { 'X-Test': '1' } }] },
    }

    expect(resolveTransportConfig('traces', config)).toEqual([])
  })

  it('merges env headers with config headers, config winning', () => {
    process.env.OTEL_EXPORTER_OTLP_HEADERS = 'a=1,b=2'
    process.env.OTEL_EXPORTER_OTLP_TRACES_HEADERS = 'b=3,c=4'

    const config = {
      exporters: {
        traces: {
          endpoint: 'http://collector:4318/v1/traces',
          headers: { c: '5' },
        },
      },
    }

    const traces = resolveTransportConfig('traces', config)
    expect(traces[0].headers).toEqual({ a: '1', b: '3', c: '5' })
  })

  it('parses timeout and compression from the environment', () => {
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = 'http://collector:4318'
    process.env.OTEL_EXPORTER_OTLP_TIMEOUT = '5000'
    process.env.OTEL_EXPORTER_OTLP_COMPRESSION = 'gzip'

    const traces = resolveTransportConfig('traces')
    expect(traces[0].timeout).toBe(5000)
    expect(traces[0].compression).toBe('gzip')
  })

  it('ignores an invalid timeout and defaults invalid compression to gzip', () => {
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = 'http://collector:4318'
    process.env.OTEL_EXPORTER_OTLP_TIMEOUT = 'soon'
    process.env.OTEL_EXPORTER_OTLP_COMPRESSION = 'brotli'

    const traces = resolveTransportConfig('traces')
    expect(traces[0].timeout).toBeUndefined()
    expect(traces[0].compression).toBe('gzip')
  })
})

describe('normalizeOtlpEndpointUrl', () => {
  it('rewrites grpc:// to http://', () => {
    expect(normalizeOtlpEndpointUrl('grpc://collector:4317', 'traces')).toBe(
      'http://collector:4317/',
    )
  })

  it('assumes http for scheme-less endpoints', () => {
    expect(normalizeOtlpEndpointUrl('collector:4318', 'traces')).toBe(
      'http://collector:4318/',
    )
  })

  it('passes through http(s) endpoints unchanged', () => {
    expect(
      normalizeOtlpEndpointUrl('https://collector:4318/v1/traces', 'traces'),
    ).toBe('https://collector:4318/v1/traces')
  })

  it('returns empty input unchanged', () => {
    expect(normalizeOtlpEndpointUrl('  ', 'traces')).toBe('')
  })
})

describe('exporter edge cases', () => {
  it('requires an endpoint: enableExport without one warns and exports nothing', async () => {
    const { initOpenTelemetry } = await import('../src/telemetry.js')
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
      // swallow warning under test
    })
    try {
      const result = initOpenTelemetry({
        enableExport: true,
        instrumentations: {
          pg: false,
          undici: false,
          ioredis: false,
          fs: false,
          runtimeNode: false,
        },
      })
      // No endpoint configured, so no OTLP readers/processors should exist.
      // The init must warn loudly instead of falling back to localhost.
      expect(warnSpy).toHaveBeenCalled()
      const message = String(warnSpy.mock.calls[0]?.[0] ?? '')
      expect(message).toMatch(/enableExport.*endpoint/i)
      await result.shutdown()
    } finally {
      warnSpy.mockRestore()
    }
  })

  it('unmatched config without endpoint is skipped, not defaulted', () => {
    const config = {
      exporters: { traces: [{ headers: { 'X-Test': '1' } }] },
    }
    expect(resolveTransportConfig('traces', config)).toEqual([])
  })
})

describe('PII redaction', () => {
  it('exposes a denylist covering usernames and secrets', () => {
    expect(SENTRY_PII_DENYLIST).toContain('username')
    expect(SENTRY_PII_DENYLIST).toContain('token')
  })

  it('scrubs user to id-only and drops guild/channel names', () => {
    const event = scrubSentryEvent({
      user: { id: '123', username: 'someone#0001', email: 'a@b.c' },
      contexts: {
        guild: { id: '1', name: 'Secret Guild' },
        channel: { id: '2', name: 'secret-channel', type: 0 },
        interaction: { id: '3', commandName: 'ping' },
      },
      extra: { token: 'abc', safe: 'ok' },
      breadcrumbs: [{ data: { username: 'leak', ok: 1 } }],
    } as unknown as Record<string, unknown>) as unknown as {
      user: Record<string, unknown>
      contexts: Record<string, Record<string, unknown>>
      extra: Record<string, unknown>
      breadcrumbs: Array<{ data: Record<string, unknown> }>
    }

    expect(event.user).toEqual({ id: '123' })
    expect(event.contexts.guild).not.toHaveProperty('name')
    expect(event.contexts.guild.id).toBe('1')
    expect(event.contexts.channel).not.toHaveProperty('name')
    expect(event.extra.token).toBe('[Redacted]')
    expect(event.extra.safe).toBe('ok')
    expect(event.breadcrumbs[0].data.username).toBe('[Redacted]')
  })

  it('redacts token patterns nested inside extra/contexts/breadcrumb data', () => {
    const discordToken = `${'a'.repeat(24)}.${'b'.repeat(6)}.${'c'.repeat(27)}`
    const event = scrubSentryEvent({
      contexts: {
        run: { note: `leaked ${discordToken}` },
      },
      extra: { auth: 'Bearer abcdef12345', nested: { deep: discordToken } },
      breadcrumbs: [{ data: { detail: `saw ${discordToken}` } }],
    } as unknown as Record<string, unknown>) as unknown as {
      contexts: Record<string, Record<string, unknown>>
      extra: Record<string, unknown>
      breadcrumbs: Array<{ data: Record<string, unknown> }>
    }

    expect(JSON.stringify(event)).not.toContain(discordToken)
    expect(JSON.stringify(event)).not.toContain('abcdef12345')
    expect(event.extra.auth).toBe('Bearer [Redacted]')
    expect(event.contexts.run.note).toBe('leaked [Redacted]')
    expect(event.breadcrumbs[0].data.detail).toBe('saw [Redacted]')
  })

  it('keeps non-PII name keys like contexts.runtime.name', () => {
    const event = scrubSentryEvent({
      contexts: {
        runtime: { name: 'node', version: '22' },
        os: { name: 'linux' },
        guild: { id: '1', name: 'Secret Guild' },
      },
    } as unknown as Record<string, unknown>) as unknown as {
      contexts: Record<string, Record<string, unknown>>
    }

    expect(event.contexts.runtime.name).toBe('node')
    expect(event.contexts.os.name).toBe('linux')
    // Guild/channel stay id-only even without a bare "name" denylist entry.
    expect(event.contexts.guild).not.toHaveProperty('name')
    expect(event.contexts.guild.id).toBe('1')
  })
})

describe('composite propagator', () => {
  it('combines W3C trace/baggage with Sentry', async () => {
    const composite = new CompositePropagator({
      propagators: [
        new W3CTraceContextPropagator(),
        new W3CBaggagePropagator(),
      ],
    })
    expect(composite.fields()).toContain('traceparent')
    expect(composite.fields()).toContain('baggage')

    // traceparent round-trip
    const carrier: Record<string, string> = {}
    const { context, trace } = await import('@opentelemetry/api')
    const tracer = trace.getTracer('test')
    const span = tracer.startSpan('test-span')
    const ctx = trace.setSpanContext(context.active(), span.spanContext())
    composite.inject(ctx, carrier, {
      set: (c: Record<string, string>, k: string, v: string) => {
        c[k] = v
      },
    })
    expect(carrier.traceparent).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-/)
    span.end()
  })

  it('withholds traceparent/baggage from arbitrary external hosts', async () => {
    const composite = new CompositePropagator({
      propagators: [
        new W3CTraceContextPropagator(),
        new W3CBaggagePropagator(),
      ],
    })
    const { context, propagation, trace } = await import('@opentelemetry/api')
    // Fake client span carrying the request URL, as undici sets url.full before inject.
    const fakeSpan = {
      attributes: { 'url.full': 'https://tagscript.example.com/v1/run' },
      spanContext: () => ({
        traceId: 'd'.repeat(32),
        spanId: 'e'.repeat(16),
        traceFlags: 1,
      }),
    }
    const ctx = propagation.setBaggage(
      trace.setSpan(context.active(), fakeSpan as unknown as Span),
      propagation.createBaggage({ foo: { value: 'bar' } }),
    )
    const carrier: Record<string, string> = {}
    composite.inject(ctx, carrier, {
      set: (c: Record<string, string>, k: string, v: string) => {
        c[k] = v
      },
    })
    expect(carrier).not.toHaveProperty('traceparent')
    expect(carrier).not.toHaveProperty('baggage')
  })

  it('still injects traceparent for internal targets', async () => {
    const propagator = new W3CTraceContextPropagator()
    const { context, trace } = await import('@opentelemetry/api')
    const fakeSpan = {
      attributes: { 'url.full': 'http://localhost:4318/v1/traces' },
      spanContext: () => ({
        traceId: 'd'.repeat(32),
        spanId: 'e'.repeat(16),
        traceFlags: 1,
      }),
    }
    const ctx = trace.setSpan(context.active(), fakeSpan as unknown as Span)
    const carrier: Record<string, string> = {}
    propagator.inject(ctx, carrier, {
      set: (c: Record<string, string>, k: string, v: string) => {
        c[k] = v
      },
    })
    expect(carrier.traceparent).toMatch(/^00-/)
  })

  it('classifies internal vs external trace targets', () => {
    expect(isInternalTraceTarget(undefined)).toBe(true)
    expect(isInternalTraceTarget('http://localhost:4318/v1/traces')).toBe(true)
    expect(isInternalTraceTarget('http://10.0.0.5/x')).toBe(true)
    expect(isInternalTraceTarget('https://tagscript.example.com/run')).toBe(
      false,
    )
    expect(isInternalTraceTarget('https://discord.com/api')).toBe(false)
  })
})
