import { parentPort } from 'node:worker_threads'
import type {
  LocalMetricReader,
  LocalMetricSnapshot,
} from '@thesharks/analytics'
import type { DashboardModel } from '@thesharks/tui'
import type { Shard, ShardingManager } from 'discord.js'

/** Worker-only sampling; regular bot IPC continues to use discord.js unchanged. */
export function publishLocalMetrics(reader: LocalMetricReader): () => void {
  const port = parentPort
  if (!port) return () => undefined
  let stopped = false
  let busy = false
  const sample = async () => {
    if (stopped || busy) return
    busy = true
    try {
      const snapshot = await reader.snapshot()
      if (!stopped) port.postMessage({ _wildbeast: 'metrics', snapshot })
    } catch {
      // Manager marks an absent sample stale; telemetry must not crash a worker.
    } finally {
      busy = false
    }
  }
  const timer = setInterval(() => void sample(), 2_000)
  timer.unref()
  const stop = () => {
    stopped = true
    clearInterval(timer)
    port.off('message', onMessage)
  }
  const onMessage = (message: unknown) => {
    if (
      (message as { _wildbeast?: string } | null)?._wildbeast === 'metrics:stop'
    )
      stop()
  }
  port.on('message', onMessage)
  return stop
}

/** The transport is internal worker IPC, never Discord messages. */
export function connectLocalMetrics(
  manager: ShardingManager,
  model: DashboardModel,
): () => void {
  const cleanups = new Map<number, { shard: Shard; cleanup: () => void }>()
  const attach = (shard: Shard) => {
    cleanups.get(shard.id)?.cleanup()
    const source = `shard:${shard.id}`
    const message = (data: unknown) => {
      const payload = data as {
        _wildbeast?: string
        snapshot?: LocalMetricSnapshot
      } | null
      if (payload?._wildbeast === 'metrics' && payload.snapshot)
        model.update(source, payload.snapshot)
    }
    const clear = () => model.removeSource(source)
    shard.on('message', message)
    shard.on('death', clear)
    shard.on('spawn', clear)
    cleanups.set(shard.id, {
      shard,
      cleanup: () => {
        shard.off('message', message)
        shard.off('death', clear)
        shard.off('spawn', clear)
      },
    })
  }
  manager.on('shardCreate', attach)
  for (const shard of manager.shards.values()) attach(shard)
  return () => {
    manager.off('shardCreate', attach)
    for (const { shard, cleanup } of cleanups.values()) {
      cleanup()
      void shard.send({ _wildbeast: 'metrics:stop' }).catch(() => undefined)
    }
    cleanups.clear()
  }
}
