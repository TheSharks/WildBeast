import { parentPort, workerData } from 'node:worker_threads'
import type { SapphireClient } from '@sapphire/framework'
import * as Sentry from '@sentry/node'
import { initOpenTelemetry } from '@thesharks/analytics'
import { validateEnv } from './env.mjs'
import { setTaskFlagShardId } from './features/context.mjs'
import { WORKER_TELEMETRY_SHUTDOWN_TIMEOUT_MILLIS } from './sharding/lifecycle.mjs'

// Validate before anything else touches the DB or Redis: workers inherit the
// manager's already-validated environment, but a direct `node dist/index.mjs`
// must fail here with a readable message instead of deep inside pg/ioredis.
// This also guarantees validateEnv runs before the first getDb().
const env = validateEnv()

// discord.js exposes the shard id as SHARDS: via env in process mode, via
// workerData in worker mode (where all shards share one pid, so falling back
// to the pid would give every shard the same service.instance.id).
const shardId =
  process.env.SHARD_ID ??
  process.env.SHARDS ??
  (workerData?.SHARDS !== undefined ? String(workerData.SHARDS) : undefined)

// SHARE_ENV makes process.env common to every worker in this cluster. Keep
// the resolved id in this worker's module isolate so scheduled-task OFREP
// targeting cannot be contaminated by another shard.
setTaskFlagShardId(shardId)

const environment = env.NODE_ENV ?? 'development'
const baseTracesSampleRate = environment === 'production' ? 0.2 : 1.0

// The manager resolves the cluster id and shares it via env.
const clusterId = env.WILDBEAST_CLUSTER_ID

// Must run as early as possible.
const telemetry = initOpenTelemetry({
  serviceName: '@thesharks/discord',
  namespace: '@thesharks',
  shardId,
  shutdownTimeoutMillis: WORKER_TELEMETRY_SHUTDOWN_TIMEOUT_MILLIS,
  resourceAttributes: clusterId ? { 'cluster.id': clusterId } : undefined,
  sentry: {
    // Make Sentry error events filterable by shard and cluster, matching
    // the OTel resource attributes.
    tags: {
      ...(shardId !== undefined ? { 'shard.id': shardId } : {}),
      ...(clusterId ? { 'cluster.id': clusterId } : {}),
    },
    // Profile chunks are only collected while a sampled trace is active, so
    // the tracesSampler below already bounds profiling volume. Defaults to
    // 0 (profiler off); set SENTRY_PROFILE_SESSION_SAMPLE_RATE to opt in.
    profileSessionSampleRate: env.SENTRY_PROFILE_SESSION_SAMPLE_RATE ?? 0,
    // We can't tail-sample errors client-side, so bias instead: always keep
    // command traces (low volume, where the user-facing errors are), keep a
    // sliver of the always-on scheduled task runs, and sample everything
    // else at the base rate.
    tracesSampler: (ctx) => {
      if (ctx.name.startsWith('discord.command.')) {
        return 1
      }
      if (ctx.name.startsWith('discord.task.')) {
        return environment === 'production' ? 0.05 : 1
      }
      if (typeof ctx.parentSampled === 'boolean') {
        return ctx.parentSampled
      }
      return baseTracesSampleRate
    },
  },
})

let shuttingDown = false

async function shutdown() {
  if (shuttingDown) {
    return
  }
  shuttingDown = true

  try {
    await client?.destroy()
  } catch {
    // continue shutting down telemetry even if the client fails to close
  }
  try {
    // Clean shutdown invalidates the persisted gateway session: destroy()
    // closed the connection with code 1000, which invalidates the session
    // on Discord's side, so leaving the Redis copy would send the next boot
    // into a doomed resume. Handoffs (handoffExit) keep it instead.
    if (sessionStore && shardId !== undefined) {
      const numericId = Number(shardId)
      if (Number.isInteger(numericId)) {
        sessionStore.update(numericId, null)
      }
    }
    await sessionStore?.close()
  } catch {
    // session invalidation is best-effort; a stale key ages out via TTL
  }
  try {
    const { closeSharedWorkerRedis } = await import('./utils/redis.mjs')
    await closeSharedWorkerRedis()
  } catch {
    // redis teardown is best-effort
  }
  try {
    const { closeDb } = await import('@thesharks/drizzle')
    await closeDb()
  } catch {
    // pool may never have been created
  }
  try {
    const { closeFeatureFlags } = await import('./features/client.mjs')
    await closeFeatureFlags()
  } catch {
    // flag providers hold no state worth dying over
  }
  try {
    await telemetry.shutdown()
  } finally {
    process.exit(0)
  }
}

/**
 * Handoff exit: flush the persisted session and leave WITHOUT closing the
 * gateway. client.destroy() would close with code 1000, which invalidates
 * the session on Discord's side; a dead socket keeps it resumable, so the
 * cluster taking this shard over can RESUME (no identify spent, missed
 * events replayed) instead of starting cold.
 */
async function handoffExit() {
  if (shuttingDown) {
    return
  }
  shuttingDown = true

  try {
    await sessionStore?.close()
  } catch (error) {
    client?.logger?.error(
      'Failed to flush session store during handoff:',
      error,
    )
  }
  try {
    const { closeSharedWorkerRedis } = await import('./utils/redis.mjs')
    await closeSharedWorkerRedis()
  } catch {
    // best-effort
  }
  try {
    const { closeDb } = await import('@thesharks/drizzle')
    await closeDb()
  } catch {
    // best-effort
  }
  try {
    await telemetry.shutdown()
  } finally {
    process.exit(0)
  }
}

process.once('SIGINT', shutdown)
process.once('SIGTERM', shutdown)

// Signals are only delivered to the main thread, so in worker mode the
// sharding manager relays lifecycle commands as messages instead.
function wildbeastCommand(message: unknown): unknown {
  if (typeof message !== 'object' || message === null) {
    return undefined
  }
  return (message as { _wildbeast?: unknown })._wildbeast
}

function onManagerMessage(message: unknown): void {
  const command = wildbeastCommand(message)
  if (command === 'shutdown') {
    void shutdown()
  } else if (command === 'handoff') {
    void handoffExit()
  }
}

parentPort?.on('message', onManagerMessage)
process.on('message', onManagerMessage)

let client: SapphireClient | undefined
let sessionStore:
  | import('./sharding/sessionStore.mjs').RedisSessionStore
  | undefined

try {
  const imported = await import('./structures/client.mjs')
  client = imported.client
  sessionStore = imported.sessionStore
  // Optional OFREP feature flags; a no-op unless configured, and a failed
  // flag service never blocks login (in-code defaults apply).
  const { initFeatureFlags } = await import('./features/client.mjs')
  await initFeatureFlags({ logger: client.logger })
  await client.login(env.DISCORD_TOKEN)
  client.logger.info('Logged in')
} catch (error) {
  Sentry.captureException(error)
  if (client) {
    client.logger?.fatal(error)
    await client.destroy()
  }
  try {
    const { closeDb } = await import('@thesharks/drizzle')
    await closeDb()
  } catch {
    // ignore
  }
  await Sentry.flush(2000)
  process.exit(1)
}
