import { describe, expect, it } from 'vitest'
import {
  SHARD_STOP_GRACE_MILLIS,
  WORKER_SENTRY_FLUSH_TIMEOUT_MILLIS,
  WORKER_TELEMETRY_SHUTDOWN_TIMEOUT_MILLIS,
} from '../src/sharding/lifecycle.mjs'

describe('worker shard lifecycle configuration', () => {
  it('keeps telemetry flushing comfortably inside the manager grace', () => {
    const telemetryBudget =
      WORKER_TELEMETRY_SHUTDOWN_TIMEOUT_MILLIS +
      WORKER_SENTRY_FLUSH_TIMEOUT_MILLIS

    expect(SHARD_STOP_GRACE_MILLIS - telemetryBudget).toBeGreaterThanOrEqual(
      10_000,
    )
  })
})
