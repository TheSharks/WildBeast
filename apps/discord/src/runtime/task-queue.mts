import { createHash } from 'node:crypto'
import type { AppConfig } from './config.mjs'

/** Stable across restarts and handoffs, separate across bots and shard totals. */
export function taskQueueName(
  config: Pick<
    AppConfig,
    'identifyKeyPrefix' | 'sessionKeyPrefix' | 'shardIds'
  >,
): string {
  const namespace = createHash('sha256')
    .update(
      JSON.stringify([
        config.identifyKeyPrefix,
        config.sessionKeyPrefix,
        [...config.shardIds].sort((a, b) => a - b),
      ]),
    )
    .digest('hex')
    .slice(0, 24)
  return `scheduled-tasks-${namespace}`
}

export function ownsTask(
  shardIds: readonly number[],
  required?: number,
): boolean {
  // A standalone client manages all shards itself.
  return (
    required === undefined ||
    shardIds.length === 0 ||
    shardIds.includes(required)
  )
}
