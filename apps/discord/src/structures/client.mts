import '@sapphire/plugin-hmr/register'
import '@sapphire/plugin-i18next/register'
import '@sapphire/plugin-scheduled-tasks/register'
import '@thesharks/analytics/register'

import {
  ApplicationCommandRegistries,
  LogLevel,
  RegisterBehavior,
  SapphireClient,
} from '@sapphire/framework'
import { GatewayIntentBits } from 'discord.js'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { epochKeyPrefix } from '../sharding/epochs.mjs'
import { buildRedisIdentifyThrottler } from '../sharding/identifyThrottler.mjs'
import {
  installSessionPersistence,
  RedisSessionStore,
} from '../sharding/sessionStore.mjs'
import {
  getSharedWorkerRedis,
  redisConnectionOptions,
} from '../utils/redis.mjs'

// The registry is the complete desired application-command set. Bulk
// overwrite updates it atomically and removes commands deleted by a deploy;
// append/update mode would leave old v8 commands registered forever.
ApplicationCommandRegistries.setDefaultBehaviorWhenNotIdentical(
  RegisterBehavior.BulkOverwrite,
)

const loglev = process.env.TRACE
  ? LogLevel.Trace
  : process.env.NODE_ENV === 'development'
    ? LogLevel.Debug
    : LogLevel.Info

const hmr = {
  enabled: process.env.NODE_ENV === 'development',
}

const client = new SapphireClient({
  intents: [GatewayIntentBits.Guilds],
  baseUserDirectory: join(dirname(fileURLToPath(import.meta.url)), '..'),
  logger: {
    level: loglev,
  },
  ws: {
    // Identifies are rate limited per bot token across all clusters, so the
    // budget is coordinated through Redis rather than per-process.
    buildIdentifyThrottler: buildRedisIdentifyThrottler,
  },
  tasks: {
    bull: {
      connection: redisConnectionOptions(),
    },
  },
  hmr,
  i18n: {
    defaultLanguageDirectory: join(
      dirname(fileURLToPath(import.meta.url)),
      '..',
      'languages',
    ),
    hmr,
  },
})

// Gateway sessions live in Redis so shard handoffs between clusters can
// RESUME instead of re-identifying. Sessions are scoped to the fleet epoch
// (set by the manager): a session from another shard total must never be
// resumed, since shard ids mean different guilds there.
const epoch = process.env.WILDBEAST_EPOCH
const sessionStore = new RedisSessionStore(getSharedWorkerRedis(), {
  keyPrefix: epoch ? epochKeyPrefix(Number(epoch)) : undefined,
})
installSessionPersistence(client, sessionStore)

export { client, sessionStore }
