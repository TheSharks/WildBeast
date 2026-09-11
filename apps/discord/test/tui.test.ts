import { EventEmitter } from 'node:events'
import type { LocalMetricReader } from '@thesharks/analytics'
import { DashboardModel } from '@thesharks/tui'
import type { Shard, ShardingManager } from 'discord.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

const { port } = vi.hoisted(() => ({ port: { value: undefined as unknown } }))
vi.mock('node:worker_threads', () => ({
  get parentPort() {
    return port.value
  },
}))

import {
  connectLocalMetrics,
  publishLocalMetrics,
} from '../src/telemetry/tui.mjs'

const snapshot = { collectedAt: 1_000, points: [], errors: 0, truncated: false }
afterEach(() => vi.useRealTimers())

describe('TUI worker transport', () => {
  it('keeps shard sources isolated and cleans up on death, replacement and detach', async () => {
    const shard = (id: number) =>
      Object.assign(new EventEmitter(), {
        id,
        send: vi.fn().mockResolvedValue(undefined),
      })
    const first = shard(0)
    const manager = Object.assign(new EventEmitter(), {
      shards: new Map([[0, first]]),
    })
    const model = new DashboardModel()
    const disconnect = connectLocalMetrics(
      manager as unknown as ShardingManager,
      model,
    )
    first.emit('message', { _wildbeast: 'metrics', snapshot })
    expect(model.sources.has('shard:0')).toBe(true)
    first.emit('death')
    expect(model.sources.size).toBe(0)
    const replacement = shard(0)
    manager.emit('shardCreate', replacement as unknown as Shard)
    expect(first.listenerCount('message')).toBe(0)
    replacement.emit('message', { _wildbeast: 'unrelated', snapshot })
    expect(model.sources.size).toBe(0)
    replacement.emit('message', { _wildbeast: 'metrics', snapshot })
    expect(model.sources.has('shard:0')).toBe(true)
    disconnect()
    expect(replacement.listenerCount('message')).toBe(0)
    expect(manager.listenerCount('shardCreate')).toBe(0)
    expect(replacement.send).toHaveBeenCalledWith({
      _wildbeast: 'metrics:stop',
    })
  })

  it('samples workers without overlaps and stops on detach messages', async () => {
    vi.useFakeTimers()
    const parent = Object.assign(new EventEmitter(), { postMessage: vi.fn() })
    port.value = parent
    const reader = { snapshot: vi.fn().mockResolvedValue(snapshot) }
    const stop = publishLocalMetrics(reader as unknown as LocalMetricReader)
    try {
      await vi.advanceTimersByTimeAsync(2_000)
      expect(parent.postMessage).toHaveBeenCalledWith({
        _wildbeast: 'metrics',
        snapshot,
      })
      parent.emit('message', { _wildbeast: 'metrics:stop' })
      await vi.advanceTimersByTimeAsync(6_000)
      expect(reader.snapshot).toHaveBeenCalledOnce()
      expect(parent.listenerCount('message')).toBe(0)
    } finally {
      stop()
    }
  })
})
