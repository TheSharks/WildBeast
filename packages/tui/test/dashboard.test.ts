import { stripVTControlCharacters } from 'node:util'
import type { LocalMetricPoint } from '@thesharks/analytics'
import stringWidth from 'string-width'
import { describe, expect, it, vi } from 'vitest'
import { clean, DashboardModel } from '../src/model.js'
import { queueTotal, render } from '../src/render.js'

const point: LocalMetricPoint = {
  name: 'discord_commands_total',
  description: 'Commands executed',
  meter: 'test',
  unit: '',
  kind: 'counter',
  value: 10,
  attributes: { command: 'ping' },
  startTime: 0,
}
const sample = (
  model: DashboardModel,
  time: number,
  value: number,
  source = 'shard:0',
  extra = {},
) =>
  model.update(source, {
    collectedAt: time,
    points: [{ ...point, value, ...extra }],
    errors: 0,
    truncated: false,
  })
const status = {
  title: 'test cluster',
  phase: 'serving',
  startedAt: 0,
  shards: [{ id: 0, status: 'ready' }],
}

describe('dashboard interactions and retention', () => {
  it('computes per-source rates, resets on worker restart, and bounds history', () => {
    const model = new DashboardModel()
    sample(model, 1_000, 10)
    sample(model, 3_000, 16)
    sample(model, 3_000, 999, 'shard:1')
    expect(model.metrics()[0].rate).toBe(3)
    expect(model.metrics()[1].rate).toBeUndefined()
    sample(model, 5_000, 20, 'shard:0', { startTime: 4_000 })
    expect(model.metrics()[0].rate).toBeUndefined()
    for (let i = 6; i < 100; i++) sample(model, i * 1_000, i)
    expect(model.metrics()[0].history).toHaveLength(60)
    model.removeSource('shard:0')
    expect(model.metrics()).toHaveLength(1)
  })

  it('filters labels, switches sources, pauses samples and logs, and removes vanished series', () => {
    const model = new DashboardModel()
    sample(model, 1_000, 10)
    sample(model, 1_000, 20, 'shard:1', { attributes: { command: 'tag' } })
    model.key('2', {})
    model.key('/', {})
    for (const char of 'ping') model.key(char, {})
    expect(model.metrics()).toHaveLength(1)
    model.key('', { name: 'escape' })
    model.key('s', {})
    expect(model.metrics()[0].source).toBe('shard:0')
    model.key(' ', {})
    sample(model, 3_000, 100)
    model.addLog('while paused')
    expect(model.metrics()[0].value).toBe(10)
    expect(model.logs).toHaveLength(0)
    model.key(' ', {})
    model.update('shard:0', {
      collectedAt: 5_000,
      points: [],
      errors: 0,
      truncated: false,
    })
    expect(model.metrics()).toHaveLength(0)
    expect(model.key('q', {})).toBe('detach')
    expect(model.key('c', { ctrl: true, name: 'c' })).toBe('shutdown')
  })

  it('bounds logs, filters warnings, scrolls and follows live again', () => {
    const model = new DashboardModel()
    for (let i = 0; i < 1_100; i++) model.addLog(`info ${i}`)
    expect(model.logs).toHaveLength(1_000)
    model.addLog('WARN slow gateway')
    model.key('3', {})
    model.key('e', {})
    expect(model.filteredLogs()).toHaveLength(1)
    model.key('e', {})
    model.key('', { name: 'up' })
    model.addLog('next')
    expect(model.logOffset).toBe(2)
    model.key('', { name: 'end' })
    expect(model.logOffset).toBe(0)
  })

  it('keeps paused samples visible without aging them out of the overview', () => {
    const model = new DashboardModel()
    sample(model, 1_000, 10)
    const clock = vi.spyOn(Date, 'now').mockReturnValue(2_000)
    try {
      model.key(' ', {})
      const frame = stripVTControlCharacters(
        render(model, status, 100, 32, 60_000),
      )
      expect(frame).toContain('PAUSED')
      expect(frame).toContain('Commands  10')
      model.key(' ', {})
      expect(model.pausedAt).toBeUndefined()
    } finally {
      clock.mockRestore()
    }
  })

  it('deduplicates shared queues across workers using the latest sample', () => {
    const model = new DashboardModel()
    sample(model, 1_000, 12, 'shard:0', {
      name: 'bullmq_queue_waiting',
      attributes: { queue_name: 'shared' },
    })
    sample(model, 2_000, 7, 'shard:1', {
      name: 'bullmq_queue_waiting',
      attributes: { queue_name: 'shared' },
    })
    sample(model, 1_000, 3, 'shard:2', {
      name: 'bullmq_queue_waiting',
      attributes: { queue_name: 'other' },
    })
    expect(queueTotal(model.metrics(), 'bullmq_queue_waiting')).toBe(10)
    expect(queueTotal(model.metrics(), 'bullmq_queue_failed')).toBeUndefined()
  })

  it('sanitizes terminal controls and clips every view to the available screen', () => {
    expect(clean('\x1b[2Jattack\r\n\x07')).toBe('attack   ')
    const model = new DashboardModel()
    sample(model, 1_000, 10)
    model.addLog('\x1b[31mhello 古 👩‍💻 café\x1b[0m')
    for (const view of ['overview', 'metrics', 'logs'] as const) {
      model.view = view
      for (const [columns, rows] of [
        [100, 32],
        [60, 16],
        [20, 5],
      ]) {
        const lines = stripVTControlCharacters(
          render(model, status, columns, rows, 2_000),
        ).split('\r\n')
        expect(lines).toHaveLength(rows)
        for (const line of lines)
          expect(stringWidth(line)).toBeLessThan(columns)
      }
    }
    model.view = 'metrics'
    expect(
      stripVTControlCharacters(render(model, status, 100, 32, 20_000)),
    ).toContain('STALE')
  })
})
