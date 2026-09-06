import { hostname } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as Sentry from '@sentry/node'
import {
  AnalyticsLogger,
  createGauge,
  initOpenTelemetry,
} from '@thesharks/analytics'
import { ShardingManager } from 'discord.js'
import { loadEnv } from './env.mjs'
import { discordShardingHost } from './fleet/discord.mjs'
import { FleetManager } from './fleet/manager.mjs'
import { logLevelFor } from './runtime/client.mjs'
import { parseClusteringConfig } from './sharding/config.mjs'
import { redisConnectionOptions } from './utils/redis.mjs'

// Load and validate before telemetry so SENTRY_DSN and OTEL_* are picked up.
const env = loadEnv()

// Defaults include the pid so two clusters on one host never share an id;
// production fleets set a stable WILDBEAST_CLUSTER_ID so restarts hash back.
const clusterId = env.WILDBEAST_CLUSTER_ID ?? `${hostname()}-${process.pid}`
process.env.WILDBEAST_CLUSTER_ID = clusterId

const telemetry = initOpenTelemetry({
  serviceName: '@thesharks/discord-manager',
  namespace: '@thesharks',
  resourceAttributes: { 'cluster.id': clusterId },
  sentry: { tags: { 'cluster.id': clusterId }, profileSessionSampleRate: 0 },
})
const logger = new AnalyticsLogger({
  level: logLevelFor({
    trace: Boolean(env.TRACE),
    development: env.NODE_ENV === 'development',
  }),
})
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
const manager = new ShardingManager(
  join(dirname(fileURLToPath(import.meta.url)), 'main.mjs'),
  {
    token: env.DISCORD_TOKEN,
    totalShards: clustering.totalShards,
    ...(clustering.mode === 'static'
      ? { shardList: clustering.shardList }
      : {}),
    mode: 'worker',
  },
)

const fleet: FleetManager = new FleetManager({
  clusterId,
  clustering,
  host: discordShardingHost(manager, logger, (shardId) =>
    fleet.isIntentionalStop(shardId),
  ),
  logger,
  redis: redisConnectionOptions(env),
  onEpoch: (state) => {
    // Workers scope persisted sessions by epoch: a session from another
    // shard total must never be resumed.
    process.env.WILDBEAST_EPOCH = String(state.epoch)
    epochParkedGauge.set(0, {})
    epochGauge.set(state.epoch, {})
  },
  onStale: () => void shutdown(1),
})

let exiting = false
async function shutdown(code = 0): Promise<never> {
  if (!exiting) {
    exiting = true
    try {
      await fleet.stop()
    } catch (error) {
      logger.error('Fleet stop failed:', error)
      Sentry.captureException(error)
      code = 1
    }
    await telemetry.shutdown()
  }
  process.exit(code)
}

process.once('SIGINT', () => void shutdown())
process.once('SIGTERM', () => void shutdown())

logger.info(
  clustering.mode === 'autonomous'
    ? `Cluster ${clusterId} joining autonomous fleet (${clustering.totalShards} total shards)`
    : `Cluster ${clusterId} managing shards [${
        clustering.shardList === 'auto'
          ? 'auto'
          : clustering.shardList.join(', ')
      }] of ${clustering.totalShards} total`,
)
if (clustering.mode === 'autonomous') epochParkedGauge.set(1, {})

try {
  await fleet.start()
  if (fleet.phase !== 'serving') await shutdown(0)
} catch (error) {
  logger.fatal('Failed to start cluster:', error)
  Sentry.captureException(error)
  await shutdown(1)
}
