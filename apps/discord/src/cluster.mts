import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { LogLevel } from '@sapphire/framework'
import * as Sentry from '@sentry/node'
import {
  AnalyticsLogger,
  createGauge,
  initOpenTelemetry,
  metrics,
} from '@thesharks/analytics'
import { type Shard, ShardingManager } from 'discord.js'
import dotEnvExtended from 'dotenv-extended'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Load the environment before telemetry so SENTRY_DSN/OTEL_* are picked up.
dotEnvExtended.load({
  errorOnMissing: true,
  path: resolve(__dirname, '../.env'),
  schema: resolve(__dirname, '../.env.schema'),
  defaults: resolve(__dirname, '../.env.defaults'),
})

const telemetry = initOpenTelemetry({
  serviceName: '@thesharks/discord-manager',
  namespace: '@thesharks',
})

const logger = new AnalyticsLogger({
  level: process.env.TRACE
    ? LogLevel.Trace
    : process.env.NODE_ENV === 'development'
      ? LogLevel.Debug
      : LogLevel.Info,
})

const meter = metrics.getMeter('@thesharks/discord-manager')
const shardLaunchCounter = meter.createCounter(
  'discord_manager_shard_launches_total',
  {
    description: 'Shard workers launched by the manager, including respawns',
  },
)
const shardDeathCounter = meter.createCounter(
  'discord_manager_shard_deaths_total',
  {
    description: 'Shard workers that exited, as seen by the manager',
  },
)
const shardErrorCounter = meter.createCounter(
  'discord_manager_shard_errors_total',
  {
    description: 'Errors reported by shard workers to the manager',
  },
)
const shardUpGauge = createGauge(
  '@thesharks/discord-manager',
  'discord_manager_shard_up',
  'Whether a shard is ready (1) or down (0), as seen by the manager',
)

const manager = new ShardingManager(join(__dirname, './index.mjs'), {
  token: process.env.DISCORD_TOKEN,
  totalShards: 2,
  mode: 'worker',
})

let shuttingDown = false

manager.on('shardCreate', (shard) => {
  const labels = { shard_id: String(shard.id) }
  logger.info(`Created shard ${shard.id}`)

  shard.on('spawn', () => {
    shardLaunchCounter.add(1, labels)
    shardUpGauge.set(0, labels)
    logger.info(`Shard ${shard.id} spawned`)
  })

  shard.on('ready', () => {
    shardUpGauge.set(1, labels)
    logger.info(`Shard ${shard.id} reported ready`)
  })

  shard.on('disconnect', () => {
    shardUpGauge.set(0, labels)
    logger.warn(`Shard ${shard.id} disconnected`)
  })

  shard.on('reconnecting', () => {
    logger.info(`Shard ${shard.id} is reconnecting`)
  })

  shard.on('death', () => {
    shardDeathCounter.add(1, labels)
    shardUpGauge.set(0, labels)

    if (shuttingDown) {
      logger.info(`Shard ${shard.id} exited`)
      return
    }

    logger.error(`Shard ${shard.id} died unexpectedly`)
    Sentry.withScope((scope) => {
      scope.setTag('shard', String(shard.id))
      Sentry.captureMessage(`Shard ${shard.id} died unexpectedly`, 'error')
    })
  })

  shard.on('error', (error) => {
    shardErrorCounter.add(1, labels)
    logger.error(`Shard ${shard.id} error:`, error)
    Sentry.withScope((scope) => {
      scope.setTag('shard', String(shard.id))
      Sentry.captureException(error)
    })
  })
})

function shardIsAlive(shard: Shard): boolean {
  return Boolean(shard.process ?? shard.worker)
}

async function waitWithTimeout(
  promise: Promise<unknown>,
  timeoutMillis: number,
): Promise<boolean> {
  let timer: NodeJS.Timeout | undefined
  try {
    return await Promise.race([
      promise.then(() => true),
      new Promise<false>((resolveTimeout) => {
        timer = setTimeout(() => resolveTimeout(false), timeoutMillis)
      }),
    ])
  } finally {
    clearTimeout(timer)
  }
}

async function shutdown() {
  if (shuttingDown) {
    return
  }
  shuttingDown = true
  // Don't respawn shards we're deliberately stopping.
  manager.respawn = false

  logger.info('Shutting down: asking shards to exit')

  // Signals are only delivered to the main thread, so worker-mode shards
  // rely on this message to destroy their client and flush telemetry
  // before exiting.
  const deaths = Promise.all(
    [...manager.shards.values()].map(
      (shard) =>
        new Promise<void>((resolveDeath) => {
          if (!shardIsAlive(shard)) {
            resolveDeath()
            return
          }
          shard.once('death', () => resolveDeath())
        }),
    ),
  )

  for (const shard of manager.shards.values()) {
    if (!shardIsAlive(shard)) {
      continue
    }
    shard.send({ _wildbeast: 'shutdown' }).catch(() => undefined)
  }

  const graceful = await waitWithTimeout(deaths, 15_000)
  if (!graceful) {
    logger.warn('Shards did not exit in time; terminating them')
    for (const shard of manager.shards.values()) {
      try {
        shard.kill()
      } catch {
        // already dead
      }
    }
  }

  await telemetry.shutdown()
  process.exit(0)
}

process.once('SIGINT', () => void shutdown())
process.once('SIGTERM', () => void shutdown())

try {
  await manager.spawn()
  logger.info(`Spawned ${manager.shards.size} shard(s)`)
} catch (error) {
  logger.fatal('Failed to spawn shards:', error)
  Sentry.captureException(error)
  await telemetry.shutdown()
  process.exit(1)
}
