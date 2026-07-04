import * as Sentry from '@sentry/node'
import { afterAll, describe, expect, it } from 'vitest'
import type { TelemetryInitResult } from '../src/telemetry.js'
import { initOpenTelemetry } from '../src/telemetry.js'
import type { TelemetryConfig } from '../src/types.js'

// Integrations only register on an enabled client, so these tests use a
// placeholder DSN with an unresolvable host; the transport is only invoked
// when something is captured, and nothing here captures. Each init swaps the
// global Sentry client, so tests run against the most recent one.
// Instrumentations are disabled to avoid re-patching modules on every init.
const FAKE_DSN = 'https://examplekey@dsn.invalid/1'

// Every Sentry.init registers process exit hooks; six inits trip the
// default listener warning without leaking anything.
process.setMaxListeners(32)

const noInstrumentations = {
  pg: false,
  undici: false,
  ioredis: false,
  fs: false,
  runtimeNode: false,
}

const inits: TelemetryInitResult[] = []

function init(sentry?: TelemetryConfig['sentry']) {
  const result = initOpenTelemetry({
    enableExport: false,
    instrumentations: noInstrumentations,
    sentry,
  })
  inits.push(result)
  const client = Sentry.getClient()
  if (!client) throw new Error('Sentry client missing after init')
  return client
}

afterAll(async () => {
  for (const result of inits) {
    await result.shutdown()
  }
})

describe('Sentry init defaults', () => {
  it('enables local variables, error-data and block-detection integrations', () => {
    const client = init({ dsn: FAKE_DSN })

    expect(client.getOptions().includeLocalVariables).toBe(true)
    expect(client.getIntegrationByName('ZodErrors')).toBeDefined()
    expect(client.getIntegrationByName('ExtraErrorData')).toBeDefined()
    expect(client.getIntegrationByName('NodeRuntimeMetrics')).toBeDefined()
    expect(client.getIntegrationByName('ThreadBlocked')).toBeDefined()
    // Profiling stays off unless a session sample rate is configured.
    expect(client.getOptions().profileSessionSampleRate).toBe(0)
    expect(client.getIntegrationByName('ProfilingIntegration')).toBeUndefined()
  })

  it('does not propagate trace headers to outgoing requests by default', () => {
    const client = init()
    expect(client.getOptions().tracePropagationTargets).toEqual([])
  })
})

describe('Sentry init overrides', () => {
  it('adds the profiling integration when a session sample rate is set', () => {
    const client = init({
      dsn: FAKE_DSN,
      profileSessionSampleRate: 0.5,
      eventLoopBlockThreshold: false,
    })
    expect(client.getOptions().profileSessionSampleRate).toBe(0.5)
    expect(client.getOptions().profileLifecycle).toBe('trace')
    expect(client.getIntegrationByName('ProfilingIntegration')).toBeDefined()
  })

  it('drops block detection when disabled', () => {
    const client = init({ dsn: FAKE_DSN, eventLoopBlockThreshold: false })
    expect(client.getIntegrationByName('ThreadBlocked')).toBeUndefined()
  })

  it('applies configured tags to every event scope', () => {
    init({ tags: { 'cluster.id': 'alpha', 'shard.id': '3' } })
    expect(Sentry.getCurrentScope().getScopeData().tags).toMatchObject({
      'cluster.id': 'alpha',
      'shard.id': '3',
    })
  })

  it('honors explicit trace propagation targets', () => {
    const client = init({ tracePropagationTargets: ['https://internal.svc'] })
    expect(client.getOptions().tracePropagationTargets).toEqual([
      'https://internal.svc',
    ])
  })
})
