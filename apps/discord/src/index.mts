import { parentPort, workerData } from 'node:worker_threads'
import type { SapphireClient } from '@sapphire/framework'
import * as Sentry from '@sentry/node'
import { initOpenTelemetry } from '@thesharks/analytics'

// discord.js exposes the shard id as SHARDS: via env in process mode, via
// workerData in worker mode (where all shards share one pid, so falling back
// to the pid would give every shard the same service.instance.id).
const shardId =
  process.env.SHARD_ID ??
  process.env.SHARDS ??
  (workerData?.SHARDS !== undefined ? String(workerData.SHARDS) : undefined)

const environment = process.env.NODE_ENV ?? 'development'
const baseTracesSampleRate = environment === 'production' ? 0.2 : 1.0

// The manager resolves the cluster id and shares it via env.
const clusterId = process.env.WILDBEAST_CLUSTER_ID

// Must run as early as possible.
const telemetry = initOpenTelemetry({
  serviceName: '@thesharks/discord',
  namespace: '@thesharks',
  shardId,
  resourceAttributes: clusterId ? { 'cluster.id': clusterId } : undefined,
  sentry: {
    // Make Sentry error events filterable by shard and cluster, matching
    // the OTel resource attributes.
    tags: {
      ...(shardId !== undefined ? { 'shard.id': shardId } : {}),
      ...(clusterId ? { 'cluster.id': clusterId } : {}),
    },
    // Profile chunks are only collected while a sampled trace is active, so
    // the tracesSampler below already bounds profiling volume.
    profileSessionSampleRate: process.env.SENTRY_PROFILE_SESSION_SAMPLE_RATE
      ? Number(process.env.SENTRY_PROFILE_SESSION_SAMPLE_RATE)
      : 1.0,
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
  await client.login(process.env.DISCORD_TOKEN)
  client.logger.info('Logged in')
} catch (error) {
  Sentry.captureException(error)
  if (client) {
    client.logger?.fatal(error)
    await client.destroy()
  }
  await Sentry.flush(2000)
  process.exit(1)
}
