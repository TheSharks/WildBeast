import { captureMetrics } from '@thesharks/test-utils'
import { describe, expect, it } from 'vitest'
import { createGauge } from '../src/utils/metrics.js'

// Must be installed before createGauge acquires its meter. Delta
// temporality so collections reflect exactly what the gauge observes
// (cumulative readers retain series that stopped being observed).
const capture = captureMetrics('delta')

const gauge = createGauge('gauge-test', 'test_gauge', 'test gauge', 's')

async function currentPoints() {
  const batches = await capture.collect()
  const latest = batches.at(-1)
  for (const scope of latest?.scopeMetrics ?? []) {
    for (const metric of scope.metrics) {
      if (metric.descriptor.name === 'test_gauge') {
        return metric.dataPoints as Array<{
          attributes: Record<string, unknown>
          value: number
        }>
      }
    }
  }
  return []
}

describe('createGauge', () => {
  it('reports one data point per label set', async () => {
    gauge.set(5, { instance: 'a' })
    gauge.set(7, { instance: 'b' })

    const points = await currentPoints()
    expect(points).toHaveLength(2)
    expect(
      points.find((point) => point.attributes.instance === 'a')?.value,
    ).toBe(5)
    expect(
      points.find((point) => point.attributes.instance === 'b')?.value,
    ).toBe(7)
  })

  it('overwrites values for the same label set', async () => {
    gauge.set(9, { instance: 'a' })

    const points = await currentPoints()
    expect(
      points.find((point) => point.attributes.instance === 'a')?.value,
    ).toBe(9)
  })

  it('clears a single label set', async () => {
    gauge.clear({ instance: 'a' })

    const points = await currentPoints()
    expect(points).toHaveLength(1)
    expect(points[0].attributes.instance).toBe('b')
  })

  it('resets all label sets', async () => {
    gauge.reset()
    gauge.set(3, { instance: 'c' })

    // Only the post-reset observation may remain (the SDK may report a
    // vanished series one final time, so collect twice).
    await currentPoints()
    const points = await currentPoints()
    expect(points).toHaveLength(1)
    expect(points[0].attributes.instance).toBe('c')
  })
})
