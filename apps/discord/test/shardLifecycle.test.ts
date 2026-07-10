import { snapshotEnv } from '@thesharks/test-utils'
import { afterAll, afterEach, describe, expect, it } from 'vitest'
import {
  setTaskFlagShardId,
  taskFlagContext,
} from '../src/features/context.mjs'
import {
  SHARD_STOP_GRACE_MILLIS,
  WORKER_SENTRY_FLUSH_TIMEOUT_MILLIS,
  WORKER_TELEMETRY_SHUTDOWN_TIMEOUT_MILLIS,
} from '../src/sharding/lifecycle.mjs'

const restoreEnv = snapshotEnv(['SHARD_ID', 'WILDBEAST_CLUSTER_ID'])

afterEach(() => {
  setTaskFlagShardId(undefined)
})
afterAll(restoreEnv)

describe('worker shard lifecycle configuration', () => {
  it('keeps the task shard id in the worker module rather than shared env', () => {
    process.env.SHARD_ID = 'wrong-shared-value'
    setTaskFlagShardId('7')

    expect(taskFlagContext('metricsCollection')).toMatchObject({
      targetingKey: 'task:metricsCollection',
      shardId: '7',
      task: 'metricsCollection',
    })
  })

  it('omits shard targeting when the worker has no resolved shard id', () => {
    process.env.SHARD_ID = 'must-not-leak'
    setTaskFlagShardId(undefined)

    expect(taskFlagContext('metricsCollection')).not.toHaveProperty('shardId')
  })

  it('keeps telemetry flushing comfortably inside the manager grace', () => {
    const telemetryBudget =
      WORKER_TELEMETRY_SHUTDOWN_TIMEOUT_MILLIS +
      WORKER_SENTRY_FLUSH_TIMEOUT_MILLIS

    expect(SHARD_STOP_GRACE_MILLIS - telemetryBudget).toBeGreaterThanOrEqual(
      10_000,
    )
  })
})
