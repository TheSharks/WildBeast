import '@sapphire/plugin-hmr/register'
import '@sapphire/plugin-i18next/register'
import '@sapphire/plugin-scheduled-tasks/register'
import '@thesharks/analytics/register'

import { LogLevel, SapphireClient } from '@sapphire/framework'
import { GatewayIntentBits } from 'discord.js'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

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
  tasks: {
    bull: {
      connection: {
        host: process.env.REDIS_HOST ?? 'localhost',
        port: (() => {
          if (!process.env.REDIS_PORT) return 6379
          const port = Number.parseInt(process.env.REDIS_PORT, 10)
          return Number.isFinite(port) ? port : 6379
        })(),
        password: process.env.REDIS_PASSWORD,
        db: process.env.REDIS_DB
          ? Number.parseInt(process.env.REDIS_DB, 10)
          : undefined,
      },
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
