import { snapshotEnv } from '@thesharks/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  normalizeOtlpEndpointUrl,
  resolveTransportConfig,
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
