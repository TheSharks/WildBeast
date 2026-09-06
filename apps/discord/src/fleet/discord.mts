import * as Sentry from '@sentry/node'
import { createGauge, metrics } from '@thesharks/analytics'
import type { Shard, ShardingManager } from 'discord.js'
import type { FleetLogger, ShardingHost } from './manager.mjs'

const meter = metrics.getMeter('@thesharks/discord-manager')
const shardLaunchCounter = meter.createCounter(
  'discord_manager_shard_launches_total',
  { description: 'Shard workers launched by the manager, including respawns' },
)
const shardDeathCounter = meter.createCounter(
  'discord_manager_shard_deaths_total',
  { description: 'Shard workers that exited, as seen by the manager' },
)
const shardErrorCounter = meter.createCounter(
  'discord_manager_shard_errors_total',
  { description: 'Errors reported by shard workers to the manager' },
)
const shardUpGauge = createGauge(
  '@thesharks/discord-manager',
  'discord_manager_shard_up',
  'Whether a shard is ready (1) or down (0), as seen by the manager',
)

function alive(shard: Shard): boolean {
  return Boolean(shard.process ?? shard.worker)
}

/** discord.js ShardingManager as a ShardingHost, with per-shard telemetry. */
export function discordShardingHost(
  manager: ShardingManager,
  logger: FleetLogger,
  isIntentionalStop: (shardId: number) => boolean,
): ShardingHost {
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
      if (isIntentionalStop(shard.id)) {
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

  return {
    shardIds: () => [...manager.shards.keys()],
    isAlive: (shardId) => {
      const shard = manager.shards.get(shardId)
      return shard !== undefined && alive(shard)
    },
    start: async (shardId) => {
      const shard = manager.shards.get(shardId) ?? manager.createShard(shardId)
      // No ready timeout: identifies queue globally through Redis.
      if (!alive(shard)) await shard.spawn(-1)
    },
    spawnAll: async () => {
      await manager.spawn({ timeout: -1 })
      return manager.shards.size
    },
    send: async (shardId, message) => {
      await manager.shards.get(shardId)?.send(message)
    },
    awaitDeath: (shardId) =>
      new Promise<void>((resolve) => {
        const shard = manager.shards.get(shardId)
        if (!shard || !alive(shard)) return resolve()
        shard.once('death', () => resolve())
      }),
    kill: (shardId) => manager.shards.get(shardId)?.kill(),
    forget: (shardId) => {
      manager.shards.delete(shardId)
    },
    setRespawn: (enabled) => {
      manager.respawn = enabled
    },
  }
}
