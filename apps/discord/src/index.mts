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

// Must run as early as possible.
const telemetry = initOpenTelemetry({
  serviceName: '@thesharks/discord',
  namespace: '@thesharks',
  shardId,
  sentry: {
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

process.once('SIGINT', shutdown)
process.once('SIGTERM', shutdown)

// Signals are only delivered to the main thread, so in worker mode the
// sharding manager relays shutdown as a message instead.
function isShutdownMessage(message: unknown): boolean {
  return (
    typeof message === 'object' &&
    message !== null &&
    (message as { _wildbeast?: unknown })._wildbeast === 'shutdown'
  )
}

parentPort?.on('message', (message) => {
  if (isShutdownMessage(message)) {
    void shutdown()
  }
})

process.on('message', (message) => {
  if (isShutdownMessage(message)) {
    void shutdown()
  }
})

let client: SapphireClient | undefined

try {
  const imported = await import('./structures/client.mjs')
  client = imported.client
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
