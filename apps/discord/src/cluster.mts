import { hostname } from 'node:os'
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
import { Redis } from 'ioredis'
import { parseClusteringConfig } from './sharding/config.mjs'
import { ClusterCoordinator } from './sharding/coordination.mjs'
import {
  awaitEpochActivation,
  EpochCoordinator,
  type EpochState,
  epochKeyPrefix,
} from './sharding/epochs.mjs'
import { type ShardHost, ShardReconciler } from './sharding/reconciler.mjs'
import { redisConnectionOptions } from './utils/redis.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Load the environment before telemetry so SENTRY_DSN/OTEL_* are picked up.
dotEnvExtended.load({
  errorOnMissing: true,
  path: resolve(__dirname, '../.env'),
  schema: resolve(__dirname, '../.env.schema'),
  defaults: resolve(__dirname, '../.env.defaults'),
})

// Resolve the cluster identity once and write it back so worker threads
// (which share this env) and telemetry agree on it.
const clusterId = process.env.WILDBEAST_CLUSTER_ID ?? hostname()
process.env.WILDBEAST_CLUSTER_ID = clusterId

const telemetry = initOpenTelemetry({
  serviceName: '@thesharks/discord-manager',
  namespace: '@thesharks',
  resourceAttributes: { 'cluster.id': clusterId },
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
const epochGauge = createGauge(
  '@thesharks/discord-manager',
  'discord_cluster_epoch',
  'The fleet epoch this cluster is serving in',
)
const epochParkedGauge = createGauge(
  '@thesharks/discord-manager',
  'discord_cluster_epoch_parked',
  'Whether this cluster is parked waiting for an epoch migration (1) or serving (0)',
)

const clustering = parseClusteringConfig()

const manager = new ShardingManager(join(__dirname, './index.mjs'), {
  token: process.env.DISCORD_TOKEN,
  totalShards: clustering.totalShards,
  ...(clustering.mode === 'static' ? { shardList: clustering.shardList } : {}),
  mode: 'worker',
})

if (clustering.mode === 'autonomous') {
  // The reconciler is the only respawn authority in autonomous mode: it
  // restarts crashed shards it still owns and must not fight the manager
  // over shards that are being handed off.
  manager.respawn = false
  logger.info(
    `Cluster ${clusterId} joining autonomous fleet (${clustering.totalShards} total shards)`,
  )
} else {
  logger.info(
    `Cluster ${clusterId} managing shards [${
      clustering.shardList === 'auto' ? 'auto' : clustering.shardList.join(', ')
    }] of ${clustering.totalShards} total`,
  )
}

let shuttingDown = false
const intentionalStops = new Set<number>()

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

    if (shuttingDown || intentionalStops.has(shard.id)) {
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

const SHUTDOWN_MESSAGE = { _wildbeast: 'shutdown' }
// Handoff exits skip the gateway close so the session stays resumable and
// the next owner can RESUME instead of identifying.
const HANDOFF_MESSAGE = { _wildbeast: 'handoff' }
const SHARD_STOP_GRACE_MILLIS = 10_000

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

async function stopShard(
  shard: Shard,
  message: { _wildbeast: string } = SHUTDOWN_MESSAGE,
): Promise<void> {
  if (!shardIsAlive(shard)) return

  intentionalStops.add(shard.id)
  try {
    const death = new Promise<void>((resolveDeath) => {
      shard.once('death', () => resolveDeath())
    })
    // Signals are only delivered to the main thread, so worker-mode shards
    // rely on this message to flush telemetry before exiting.
    await shard.send(message).catch(() => undefined)

    const graceful = await waitWithTimeout(death, SHARD_STOP_GRACE_MILLIS)
    if (!graceful) {
      logger.warn(`Shard ${shard.id} did not exit in time; terminating it`)
      try {
        shard.kill()
      } catch {
        // already dead
      }
    }
  } finally {
    intentionalStops.delete(shard.id)
  }
}

// Adapts ShardingManager to the reconciler's shard lifecycle interface.
const shardHost: ShardHost = {
  currentShards: () => [...manager.shards.keys()],
  isAlive: (shardId) => {
    const shard = manager.shards.get(shardId)
    return shard !== undefined && shardIsAlive(shard)
  },
  start: async (shardId) => {
    const shard = manager.shards.get(shardId) ?? manager.createShard(shardId)
    if (!shardIsAlive(shard)) {
      // No ready timeout: identifies queue globally through Redis and can
      // legitimately take longer than the default 30s.
      await shard.spawn(-1)
    }
  },
  stop: async (shardId) => {
    const shard = manager.shards.get(shardId)
    if (!shard) return
    // Reconciler stops are handoffs: the shard's session must survive so
    // its next owner can resume it.
    await stopShard(shard, HANDOFF_MESSAGE)
    manager.shards.delete(shardId)
  },
}

let reconciler: ShardReconciler | undefined
let parkedCoordinator: ClusterCoordinator | undefined
let epochWatchdog: NodeJS.Timeout | undefined
const shutdownAbort = new AbortController()

async function startAutonomous(totalShards: number): Promise<void> {
  const redis = new Redis(redisConnectionOptions())
  const epochs = new EpochCoordinator(redis, { totalShards })
  const coordinatorFor = (state: EpochState) =>
    new ClusterCoordinator(redis, {
      clusterId,
      totalShards: state.totalShards,
      keyPrefix: epochKeyPrefix(state.epoch),
    })

  const resolution = await epochs.resolve()
  const epoch = resolution.state

  if (resolution.role === 'pending') {
    // A migration to a new shard total is in progress: park while the
    // old-total clusters keep serving, and take over the moment the last
    // one drains (i.e. when the rolling deploy completes).
    logger.warn(
      `Shard total ${totalShards} differs from the active epoch; parked as epoch ${epoch.epoch} member until the old fleet drains`,
    )
    epochParkedGauge.set(1, {})
    parkedCoordinator = coordinatorFor(epoch)

    const activated = await awaitEpochActivation({
      epochs,
      pending: epoch,
      heartbeat: () => (parkedCoordinator as ClusterCoordinator).heartbeat(),
      signal: shutdownAbort.signal,
      logger,
    })
    parkedCoordinator = undefined
    if (!activated) {
      // Shut down while parked.
      return
    }
    logger.info(`Epoch ${epoch.epoch} activated (${totalShards} shards)`)
  }

  epochParkedGauge.set(0, {})
  epochGauge.set(epoch.epoch, {})
  // Workers scope their persisted sessions by epoch: a session from another
  // shard total must never be resumed.
  process.env.WILDBEAST_EPOCH = String(epoch.epoch)

  reconciler = new ShardReconciler(
    coordinatorFor(epoch),
    shardHost,
    { clusterId, totalShards: epoch.totalShards },
    logger,
  )
  await reconciler.start()
  logger.info(
    `Reconciler started in epoch ${epoch.epoch}; shard ownership follows fleet membership`,
  )

  // If the fleet moves to a newer epoch, this process's configuration is
  // stale (promotion requires our membership to be gone, so reaching this
  // implies we were fenced or expired). Exit and let the supervisor restart
  // us — with corrected config, we rejoin; otherwise we park harmlessly.
  epochWatchdog = setInterval(() => {
    void epochs
      .activeEpoch()
      .then((active) => {
        if (active && active.epoch !== epoch.epoch) {
          logger.fatal(
            `Fleet moved to epoch ${active.epoch} (${active.totalShards} shards); this cluster's configuration is stale, exiting`,
          )
          void shutdown(1)
        }
      })
      .catch(() => {
        // coordination loss is handled by the reconciler's fencing
      })
  }, 10_000)
}

async function shutdown(code = 0) {
  if (shuttingDown) {
    return
  }
  shuttingDown = true
  // Don't respawn shards we're deliberately stopping.
  manager.respawn = false
  shutdownAbort.abort()
  if (epochWatchdog) {
    clearInterval(epochWatchdog)
  }

  logger.info('Shutting down: asking shards to exit')

  try {
    await parkedCoordinator?.withdraw()
  } catch {
    // membership entry will expire on its own
  }

  if (reconciler) {
    // Stops owned shards gracefully, releases their leases and withdraws
    // from the fleet so survivors rebalance immediately.
    await reconciler.shutdown()
  } else {
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
      shard.send(SHUTDOWN_MESSAGE).catch(() => undefined)
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
  }

  await telemetry.shutdown()
  process.exit(code)
}

process.once('SIGINT', () => void shutdown())
process.once('SIGTERM', () => void shutdown())

try {
  if (clustering.mode === 'autonomous') {
    await startAutonomous(clustering.totalShards)
  } else {
    // No ready timeout: identifies queue globally through Redis, so a shard
    // can legitimately wait longer than the default 30s when several
    // clusters start at once. Readiness is tracked via shard events instead.
    await manager.spawn({ timeout: -1 })
    logger.info(`Spawned ${manager.shards.size} shard(s)`)
  }
} catch (error) {
  logger.fatal('Failed to start cluster:', error)
  Sentry.captureException(error)
  await telemetry.shutdown()
  process.exit(1)
}
