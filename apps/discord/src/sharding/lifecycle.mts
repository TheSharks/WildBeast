/**
 * A worker's telemetry shutdown first drains OpenTelemetry up to this bound,
 * then the analytics package gives Sentry its fixed two-second flush. Keeping
 * the configurable portion short leaves the manager ample time for gateway
 * teardown and the Redis session flush before it terminates the worker.
 */
export const WORKER_TELEMETRY_SHUTDOWN_TIMEOUT_MILLIS = 5_000
export const WORKER_SENTRY_FLUSH_TIMEOUT_MILLIS = 2_000

/**
 * 5s OpenTelemetry + 2s Sentry leaves 13s for session persistence and other
 * cleanup. Both autonomous per-shard stops and static fleet shutdown use the
 * same overall deadline, so shutdown duration does not grow with shard count.
 */
export const SHARD_STOP_GRACE_MILLIS = 20_000

/**
 * Fencing and lease expiry are two clocks racing over the same invariant: a
 * fenced cluster must have stopped all its shards before another cluster can
 * acquire their expired leases. That requires
 *
 *   FENCE_AFTER + SHARD_STOP_GRACE + margin <= LEASE_TTL
 *
 * (15s + 20s + 10s <= 45s). The fence deadline must also comfortably exceed
 * the 5s liveness tick, or a single transient coordination error would fence
 * the whole cluster: at 15s it takes three consecutive failed ticks. The cost
 * of the longer TTL is failover after a hard crash — a dead cluster's shards
 * stay leased for up to 45s instead of 30s.
 */
export const DEFAULT_LEASE_TTL_MILLIS = 45_000
export const DEFAULT_FENCE_AFTER_MILLIS = 15_000

/**
 * Safety margin in the fencing invariant: even after the stop grace elapses,
 * allow this much slack for scheduling jitter and Redis TIME skew before a
 * lease may expire. See DEFAULT_LEASE_TTL_MILLIS for the full invariant.
 */
export const FENCING_SAFETY_MARGIN_MILLIS = 10_000
