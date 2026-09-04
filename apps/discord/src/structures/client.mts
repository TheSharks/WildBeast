import '@sapphire/plugin-hmr/register'
import '@sapphire/plugin-i18next/register'
import '@sapphire/plugin-scheduled-tasks/register'
import '@thesharks/analytics/register'

import {
  ApplicationCommandRegistries,
  container,
  LogLevel,
  RegisterBehavior,
  SapphireClient,
} from '@sapphire/framework'
import { GatewayIntentBits } from 'discord.js'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { validateEnv } from '../env.mjs'
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

// Re-validate for typed numerics; lenient fallback for unit tests without a bot env.
let env: ReturnType<typeof validateEnv>
try {
  env = validateEnv()
} catch {
  env = {
    TRACE: process.env.TRACE,
    NODE_ENV: process.env.NODE_ENV ?? 'test',
  } as ReturnType<typeof validateEnv>
}

// Bulk overwrite keeps deploys atomic and removes deleted commands.
ApplicationCommandRegistries.setDefaultBehaviorWhenNotIdentical(
  RegisterBehavior.BulkOverwrite,
)

const loglev = env.TRACE
  ? LogLevel.Trace
  : env.NODE_ENV === 'development'
    ? LogLevel.Debug
    : LogLevel.Info

const hmr = {
  enabled: env.NODE_ENV === 'development',
}

const client = new SapphireClient({
  intents: [GatewayIntentBits.Guilds],
  baseUserDirectory: join(dirname(fileURLToPath(import.meta.url)), '..'),
  logger: {
    level: loglev,
  },
  ws: {
    // Identify budget is per-token fleet-wide, so coordinate through Redis.
    buildIdentifyThrottler: buildRedisIdentifyThrottler,
  },
  tasks: {
    bull: {
      connection: redisConnectionOptions(env),
    },
  },
  hmr,
  i18n: {
    defaultLanguageDirectory: join(
      dirname(fileURLToPath(import.meta.url)),
      '..',
      'languages',
    ),
    // Fall back to en-US for unloaded locales/keys; prefer invoker locale over guild.
    fetchLanguage: (context) => {
      const locale =
        context.interactionLocale ??
        context.interactionGuildLocale ??
        context.guild?.preferredLocale
      return locale && container.i18n.languages.has(locale) ? locale : 'en-US'
    },
    hmr,
  },
})

// Sessions in Redis for resumable handoffs; scoped by epoch/total so mismatched shard ids never resume.
const sessionKeyPrefix =
  env.WILDBEAST_EPOCH !== undefined
    ? epochKeyPrefix(env.WILDBEAST_EPOCH)
    : env.WILDBEAST_SHARDING_TOTAL !== undefined
      ? `wildbeast:static:${env.WILDBEAST_SHARDING_TOTAL}`
      : 'wildbeast:static:auto'
const sessionStore = new RedisSessionStore(getSharedWorkerRedis(env), {
  keyPrefix: sessionKeyPrefix,
})
installSessionPersistence(client, sessionStore)

export { client, sessionStore }
