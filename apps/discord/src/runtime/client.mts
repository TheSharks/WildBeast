import '@sapphire/plugin-i18next/register'
import '@sapphire/plugin-scheduled-tasks/register'
import '@thesharks/analytics/register'

import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ApplicationCommandRegistries,
  container,
  LogLevel,
  RegisterBehavior,
  SapphireClient,
} from '@sapphire/framework'
import type { InternationalizationContext } from '@sapphire/plugin-i18next'
import {
  type Client,
  type ClientOptions,
  GatewayIntentBits,
  type WebSocketOptions,
} from 'discord.js'
import type { Redis } from 'ioredis'
import {
  IDENTIFY_WINDOW_MILLIS,
  RedisIdentifyThrottler,
} from '../sharding/identifyThrottler.mjs'
import {
  installSessionPersistence,
  type RedisSessionStore,
} from '../sharding/sessionStore.mjs'
import type { AppConfig } from './config.mjs'

// Bulk overwrite keeps deploys atomic and removes deleted commands.
ApplicationCommandRegistries.setDefaultBehaviorWhenNotIdentical(
  RegisterBehavior.BulkOverwrite,
)

const here = dirname(fileURLToPath(import.meta.url))

export function logLevelFor(config: Pick<AppConfig, 'trace' | 'development'>) {
  return config.trace
    ? LogLevel.Trace
    : config.development
      ? LogLevel.Debug
      : LogLevel.Info
}

/** Pieces load from this directory: the replacement application only. */
export const PIECES_DIRECTORY = join(here, '..')
export const LANGUAGES_DIRECTORY = join(here, '..', 'languages')

export function createSapphireClient(
  config: AppConfig,
  redis: Redis,
  sessions: RedisSessionStore,
): Client {
  const options: ClientOptions = {
    intents: [GatewayIntentBits.Guilds],
    // Scheduled tasks share the fleet-wide BullMQ queue on Redis.
    tasks: { bull: { connection: config.redis } },
    baseUserDirectory: PIECES_DIRECTORY,
    logger: { level: logLevelFor(config) },
    ws: {
      // The identify budget is per token, fleet wide; coordinate through Redis.
      buildIdentifyThrottler: async (
        manager: Parameters<
          NonNullable<WebSocketOptions['buildIdentifyThrottler']>
        >[0],
      ) => {
        const info = await manager.fetchGatewayInformation()
        return new RedisIdentifyThrottler(
          redis,
          info.session_start_limit.max_concurrency,
          IDENTIFY_WINDOW_MILLIS,
          {
            keyPrefix: config.identifyKeyPrefix,
            onWarn: (message) => client.logger.warn(message),
          },
        )
      },
    },
    i18n: {
      defaultLanguageDirectory: LANGUAGES_DIRECTORY,
      fetchLanguage: (context: InternationalizationContext) => {
        const locale =
          context.interactionLocale ??
          context.interactionGuildLocale ??
          context.guild?.preferredLocale
        return locale && container.i18n.languages.has(locale) ? locale : 'en-US'
      },
    },
  }
  const client = new SapphireClient(options)
  installSessionPersistence(client, sessions)
  return client
}
