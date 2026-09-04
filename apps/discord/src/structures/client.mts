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

// Validated once by the manager and inherited by workers; re-validating here
// is cheap and gives typed numerics (shard totals, epoch) for key scoping.
// Import-time validation must not throw for unit tests that import this
// module without a full bot env (frameworkStructure): fall back to lenient
// defaults there. Production entrypoints (cluster.mts, index.mts) validate
// strictly before this module loads, so misconfiguration still fails fast.
let env: ReturnType<typeof validateEnv>
try {
  env = validateEnv()
} catch {
  env = {
    TRACE: process.env.TRACE,
    NODE_ENV: process.env.NODE_ENV ?? 'test',
  } as ReturnType<typeof validateEnv>
}

// The registry is the complete desired application-command set. Bulk
// overwrite updates it atomically and removes commands deleted by a deploy;
// append/update mode would leave old v8 commands registered forever.
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
    // Identifies are rate limited per bot token across all clusters, so the
    // budget is coordinated through Redis rather than per-process.
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
    // Locales without a translation (e.g. a community server set to "nl")
    // must fall back to en-US; the plugin's default throws on unloaded
    // locales instead. Prefer the invoker's own locale over the guild
    // locale so a user setting wins in a differently-configured server.
    // fallbackLng en-US: unknown/missing locales return en-US here, and
    // missing keys in a loaded locale fall back to en-US via i18next.
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

// Gateway sessions live in Redis so shard handoffs between clusters can
// RESUME instead of re-identifying. Sessions are scoped so a session from
// another shard total is never resumed, since shard ids mean different
// guilds there: autonomous workers use their fleet epoch (set by the
// manager), static workers use their configured total (ranges sharing a
// total share sessions, so handoffs between static clusters still resume).
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
