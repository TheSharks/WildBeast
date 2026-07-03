import '@sapphire/plugin-hmr/register'
import '@sapphire/plugin-i18next/register'
import '@sapphire/plugin-scheduled-tasks/register'
import '@thesharks/analytics/register'

import { LogLevel, SapphireClient } from '@sapphire/framework'
import { GatewayIntentBits } from 'discord.js'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { buildRedisIdentifyThrottler } from '../sharding/identifyThrottler.mjs'
import { redisConnectionOptions } from '../utils/redis.mjs'

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

export { client }
