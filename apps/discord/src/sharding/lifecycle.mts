// Telemetry drain bound; leaves room for gateway teardown and session flush.
export const WORKER_TELEMETRY_SHUTDOWN_TIMEOUT_MILLIS = 5_000
export const WORKER_SENTRY_FLUSH_TIMEOUT_MILLIS = 2_000

// Shared stop deadline so shutdown duration stays flat with shard count.
export const SHARD_STOP_GRACE_MILLIS = 20_000

// CHECK: FENCE_AFTER + STOP_GRACE + margin <= LEASE_TTL (15s + 20s + 10s <= 45s); fence takes 3 failed ticks.
export const DEFAULT_LEASE_TTL_MILLIS = 45_000
export const DEFAULT_FENCE_AFTER_MILLIS = 15_000

// Slack for scheduling jitter and Redis TIME skew in the fencing invariant.
export const FENCING_SAFETY_MARGIN_MILLIS = 10_000
