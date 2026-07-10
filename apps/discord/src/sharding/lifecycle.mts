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
