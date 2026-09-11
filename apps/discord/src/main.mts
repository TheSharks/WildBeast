import { parentPort, workerData } from 'node:worker_threads'
import * as Sentry from '@sentry/node'
import {
  AnalyticsLogger,
  initOpenTelemetry,
  LocalMetricReader,
} from '@thesharks/analytics'
import { validateEnv } from './env.mjs'
import { logLevelFor } from './runtime/client.mjs'
import { composeApplication } from './runtime/composition.mjs'
import { configFromEnv } from './runtime/config.mjs'
import { WORKER_TELEMETRY_SHUTDOWN_TIMEOUT_MILLIS } from './sharding/lifecycle.mjs'
import { publishLocalMetrics } from './telemetry/tui.mjs'

// Validate before anything opens a connection; a direct `node dist/next/main.mjs`
// must fail here with a readable message.
const env = validateEnv()

// discord.js exposes the shard list as SHARDS: via env in process mode, via
// workerData in worker mode.
const shardId =
  process.env.SHARD_ID ??
  process.env.SHARDS ??
  (workerData?.SHARDS !== undefined ? String(workerData.SHARDS) : undefined)

const config = configFromEnv(env, {
  ...(shardId !== undefined ? { shardId } : {}),
})
const baseTracesSampleRate = config.development ? 1.0 : 0.2

// Must run as early as possible.
const localMetrics =
  parentPort && process.env.WILDBEAST_TUI_METRICS === '1'
    ? new LocalMetricReader()
    : undefined
const telemetry = initOpenTelemetry({
  metricReaders: localMetrics ? [localMetrics] : [],
  serviceName: '@thesharks/discord',
  namespace: '@thesharks',
  shardId,
  shutdownTimeoutMillis: WORKER_TELEMETRY_SHUTDOWN_TIMEOUT_MILLIS,
  resourceAttributes: config.clusterId
    ? { 'cluster.id': config.clusterId }
    : undefined,
  sentry: {
    tags: {
      ...(shardId !== undefined ? { 'shard.id': shardId } : {}),
      ...(config.clusterId ? { 'cluster.id': config.clusterId } : {}),
    },
    profileSessionSampleRate: env.SENTRY_PROFILE_SESSION_SAMPLE_RATE ?? 0,
    tracesSampler: (context) => {
      if (context.name.startsWith('discord.command.')) return 1
      if (context.name.startsWith('discord.task.'))
        return config.development ? 1 : 0.05
      if (typeof context.parentSampled === 'boolean')
        return context.parentSampled
      return baseTracesSampleRate
    },
  },
})

const stopLocalMetrics = localMetrics
  ? publishLocalMetrics(localMetrics)
  : undefined

const logger = new AnalyticsLogger({ level: logLevelFor(config) })
const { runtime } = composeApplication(config, { logger, telemetry })

async function stop(reason: 'shutdown' | 'handoff'): Promise<never> {
  stopLocalMetrics?.()
  let code = 0
  try {
    await runtime.stop(reason)
  } catch (error) {
    // Draining timed out or a resource refused to close; the supervisor
    // must not treat this worker as cleanly gone.
    logger.error(`Stop (${reason}) failed:`, error)
    Sentry.captureException(error)
    await Sentry.flush(2_000).catch(() => undefined)
    code = 1
  }
  process.exit(code)
}

process.once('SIGINT', () => void stop('shutdown'))
process.once('SIGTERM', () => void stop('shutdown'))

// Signals reach only the main thread; the sharding manager relays lifecycle
// commands as messages in worker mode.
function onManagerMessage(message: unknown): void {
  const command =
    typeof message === 'object' && message !== null
      ? (message as { _wildbeast?: unknown })._wildbeast
      : undefined
  if (command === 'shutdown') void stop('shutdown')
  else if (command === 'handoff') void stop('handoff')
}
parentPort?.on('message', onManagerMessage)
process.on('message', onManagerMessage)

try {
  await runtime.start()
  logger.info('WildBeast ready')
} catch (error) {
  // Startup failures aggregate the cause with any teardown failures.
  for (const cause of error instanceof AggregateError ? error.errors : [error])
    logger.fatal('WildBeast startup failed:', cause)
  Sentry.captureException(error)
  await Sentry.flush(2_000).catch(() => undefined)
  stopLocalMetrics?.()
  await telemetry.shutdown().catch(() => undefined)
  process.exit(1)
}
