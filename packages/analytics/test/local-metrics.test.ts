import { MeterProvider } from '@opentelemetry/sdk-metrics'
import { describe, expect, it } from 'vitest'
import { LocalMetricReader } from '../src/local-metrics.js'

describe('local metrics reader', () => {
  it('collects real counters, gauges and histogram summaries without draining another reader', async () => {
    const local = new LocalMetricReader()
    const other = new LocalMetricReader()
    const provider = new MeterProvider({ readers: [local, other] })
    try {
      const meter = provider.getMeter('test')
      const counter = meter.createCounter('commands')
      const gauge = meter.createObservableGauge('memory', { unit: 'By' })
      gauge.addCallback((result) => result.observe(1_024, { type: 'heap' }))
      const duration = meter.createHistogram('duration', { unit: 's' })
      counter.add(4, { command: 'ping' })
      duration.record(1)
      duration.record(3)
      const snapshot = await local.snapshot()
      expect(snapshot.points).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'commands',
            kind: 'counter',
            value: 4,
            attributes: { command: 'ping' },
          }),
          expect.objectContaining({
            name: 'memory',
            kind: 'gauge',
            value: 1_024,
            unit: 'By',
          }),
          expect.objectContaining({
            name: 'duration',
            kind: 'histogram',
            count: 2,
            value: 2,
            min: 1,
            max: 3,
          }),
        ]),
      )
      expect(structuredClone(snapshot)).toEqual(snapshot)
      counter.add(2, { command: 'ping' })
      expect(
        (await local.snapshot()).points.find((p) => p.name === 'commands')
          ?.value,
      ).toBe(6)
      expect(
        (await other.snapshot()).points.find((p) => p.name === 'commands')
          ?.value,
      ).toBe(6)
    } finally {
      await provider.shutdown()
    }
  })

  it('reports observable callback errors alongside healthy metrics', async () => {
    const reader = new LocalMetricReader()
    const provider = new MeterProvider({ readers: [reader] })
    try {
      const meter = provider.getMeter('test')
      meter.createObservableGauge('broken').addCallback(() => {
        throw new Error('broken callback')
      })
      meter.createCounter('healthy').add(1)
      const snapshot = await reader.snapshot()
      expect(snapshot.errors).toBeGreaterThan(0)
      expect(snapshot.points.some((p) => p.name === 'healthy')).toBe(true)
    } finally {
      await provider.shutdown()
    }
  })
})
