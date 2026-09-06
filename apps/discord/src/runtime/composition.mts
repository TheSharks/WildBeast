import { container } from '@sapphire/framework'
import { metrics } from '@thesharks/analytics'
import { createDatabase, sql } from '@thesharks/drizzle'
import type { Client } from 'discord.js'
import { Redis } from 'ioredis'
import { PostgresCommandIds } from '../adapters/command-ids-postgres.mjs'
import { DiscordEntitlements } from '../adapters/entitlements-discord.mjs'
import { PostgresEntitlements } from '../adapters/entitlements-postgres.mjs'
import { DiscordOperatorCommands } from '../adapters/operator-commands-discord.mjs'
import { DiscordTagCommands } from '../adapters/tag-commands-discord.mjs'
import { PostgresTags } from '../adapters/tags-postgres.mjs'
import { Experiments } from '../features/experiments.mjs'
import { FeatureFlags, ofrepProvider } from '../features/flags.mjs'
import { CommandGates } from '../features/gates.mjs'
import {
  type OperatorCommandGateway,
  OperatorCommands,
  parseGuildList,
} from '../operators/service.mjs'
import { limitFlagKey } from '../premium/limits.mjs'
import type {
  EntitlementRepository,
  EntitlementSource,
} from '../premium/model.mjs'
import { EntitlementSynchronizer, PremiumService } from '../premium/service.mjs'
import { PremiumTagLimits } from '../premium/tag-limits.mjs'
import { stopGatewayForHandoff } from '../sharding/handoff.mjs'
import { RedisSessionStore } from '../sharding/sessionStore.mjs'
import type { ScopedCommand } from '../structures/command.mjs'
import type { TagCommandGateway } from '../tags/model.mjs'
import { TagReconciler } from '../tags/reconciler.mjs'
import { TagService } from '../tags/service.mjs'
import {
  ApplicationRuntime,
  type ResourceFactory,
  type StopReason,
} from './application.mjs'
import { createSapphireClient } from './client.mjs'
import type { AppConfig } from './config.mjs'
import { type AppServices, readyClient } from './services.mjs'
import { WorkScope } from './work.mjs'

export interface CompositionLogger {
  debug(...values: readonly unknown[]): void
  info(...values: readonly unknown[]): void
  warn(...values: readonly unknown[]): void
  error(...values: readonly unknown[]): void
}

export type DatabaseConnection = ReturnType<typeof createDatabase>

// Labels frozen by METRIC_CONTRACT['discord_premium_limit_override_fallbacks_total'].
const limitOverrideFallbackCounter = metrics
  .getMeter('@thesharks/discord')
  .createCounter('discord_premium_limit_override_fallbacks_total', {
    description: 'Remote limit overrides rejected as invalid',
  })

export interface RedisConnection {
  connect(): Promise<void>
  quit(): Promise<unknown>
  disconnect(): void
}

/** Seams for composition tests; production leaves them unset. */
export interface CompositionOptions {
  logger: CompositionLogger
  telemetry?: { shutdown(): Promise<void> }
  openDatabase?: (url: string) => DatabaseConnection
  openRedis?: (config: AppConfig) => Redis
  createClient?: (
    config: AppConfig,
    redis: Redis,
    sessions: RedisSessionStore,
  ) => Client
  entitlementSource?: EntitlementSource
  entitlementRepository?: EntitlementRepository
  tagCommandGateway?: TagCommandGateway
  operatorCommandGateway?: OperatorCommandGateway
  flags?: FeatureFlags
}

export interface ComposedApplication {
  runtime: ApplicationRuntime
  services: AppServices
  /** The Discord client, once the gateway resource has opened. */
  client(): Client
}

async function ping(connection: DatabaseConnection): Promise<void> {
  // The mirror state row is created by migration 0010; its absence means
  // the schema predates the replacement.
  const result = await connection.db.execute(
    sql`SELECT 1 FROM "EntitlementMirrorState" WHERE id = 1`,
  )
  if (result.rows.length !== 1)
    throw new Error('Database schema is out of date: run migrations')
}

export function composeApplication(
  config: AppConfig,
  options: CompositionOptions,
): ComposedApplication {
  const { logger } = options
  const work = new WorkScope()
  const state: {
    database?: DatabaseConnection
    redis?: Redis
    sessions?: RedisSessionStore
    client?: Client
  } = {}
  const client = () => {
    if (!state.client) throw new Error('Discord client has not been created')
    return state.client
  }
  const ready = () => readyClient(client())

  const flags =
    options.flags ??
    new FeatureFlags({
      ...(config.flags.url
        ? {
            provider: ofrepProvider({
              url: config.flags.url,
              ...(config.flags.token ? { token: config.flags.token } : {}),
            }),
          }
        : {}),
      cacheTtlMs: config.flags.cacheTtlMs,
      baseContext: {
        environment: config.environment,
        ...(config.clusterId ? { clusterId: config.clusterId } : {}),
        ...(config.shardId !== undefined ? { shardId: config.shardId } : {}),
      },
      logger,
    })

  // Repositories bind to the connection lazily: services are constructed once,
  // before any resource opens, and only run after the runtime is ready.
  const database = () => {
    if (!state.database) throw new Error('Database is not open')
    return state.database
  }
  const entitlementRepository =
    options.entitlementRepository ??
    new PostgresEntitlements(() => database().db)
  const tagRepository = new PostgresTags({
    get db() {
      return database().db
    },
    withSession: (work) => database().withSession(work),
  })
  const commandIds = new PostgresCommandIds(() => database().db)

  const premium = new PremiumService(
    entitlementRepository,
    config.premiumSkus,
    Date.now,
    config.schedules.entitlementStaleAfterMs,
  )
  const entitlements = new EntitlementSynchronizer(
    entitlementRepository,
    options.entitlementSource ?? new DiscordEntitlements(ready),
  )
  const tagLimits = new PremiumTagLimits(
    premium,
    {
      evaluate: (key, fallback, context) =>
        flags.limit(limitFlagKey(key), fallback, {
          targetingKey: context.guildId.toString(),
          guildId: context.guildId.toString(),
          ...(context.userId !== undefined
            ? { userId: context.userId.toString() }
            : {}),
          tier: context.tier,
        }),
    },
    (key, raw, fallback) => {
      limitOverrideFallbackCounter.add(1, { key })
      logger.warn(
        `Invalid limit override for ${limitFlagKey(key)}: ${String(raw)}; using registry fallback ${fallback}`,
      )
    },
  )
  const reservedCommandNames = () =>
    new Set(
      [...container.stores.get('commands').keys()].map((name) =>
        name.toLowerCase(),
      ),
    )
  const tags = new TagService(tagRepository, tagLimits, reservedCommandNames)
  const tagReconciler = new TagReconciler(
    tagRepository,
    options.tagCommandGateway ?? new DiscordTagCommands(ready),
    (guildId) => tagLimits.forBackground(guildId),
    reservedCommandNames,
  )
  const gates = new CommandGates(flags, premium)
  const operatorCommands = new OperatorCommands(
    () =>
      [...container.stores.get('commands').values()].flatMap((command) => {
        const scoped = command as ScopedCommand
        return scoped.scope === 'operator' && scoped.operatorCommand
          ? [{ name: scoped.name, data: scoped.operatorCommand }]
          : []
      }),
    async () => {
      const setting = await flags.setting('operators.commandGuilds', {
        targetingKey: 'task:operatorCommandReconcile',
        task: 'operatorCommandReconcile',
      })
      return new Set([
        ...config.operatorGuildIds,
        ...parseGuildList(setting.value),
      ])
    },
    options.operatorCommandGateway ?? new DiscordOperatorCommands(ready),
    commandIds,
  )
  const services: AppServices = {
    config,
    work,
    flags,
    gates,
    experiments: new Experiments(flags),
    premium,
    entitlements,
    tags,
    tagLimits,
    tagReconciler,
    commandIds,
    operatorCommands,
    reservedCommandNames,
  }

  const factories: ResourceFactory[] = []
  if (options.telemetry) {
    const telemetry = options.telemetry
    factories.push({
      name: 'telemetry',
      open: async () => ({ close: () => telemetry.shutdown() }),
    })
  }
  factories.push(
    {
      name: 'database',
      open: async () => {
        const connection = (options.openDatabase ?? createDatabase)(
          config.databaseUrl,
        )
        try {
          await ping(connection)
        } catch (error) {
          await connection.close().catch(() => undefined)
          throw error
        }
        state.database = connection
        return {
          close: async () => {
            state.database = undefined
            await connection.close()
          },
        }
      },
    },
    {
      name: 'redis',
      open: async () => {
        const redis =
          options.openRedis?.(config) ??
          new Redis({ ...config.redis, lazyConnect: true })
        try {
          await redis.connect()
        } catch (error) {
          redis.disconnect()
          throw error
        }
        state.redis = redis
        return {
          close: async () => {
            state.redis = undefined
            try {
              await redis.quit()
            } finally {
              redis.disconnect()
            }
          },
        }
      },
    },
    {
      name: 'flags',
      open: async () => {
        await flags.open()
        return { close: () => flags.close() }
      },
    },
    {
      name: 'sessions',
      open: async () => {
        const sessions = new RedisSessionStore(state.redis!, {
          keyPrefix: config.sessionKeyPrefix,
          onError: (error) => logger.error('Session store:', error),
        })
        state.sessions = sessions
        return {
          close: async (reason: StopReason) => {
            // A clean close invalidated the session on Discord's side; a
            // handoff keeps it so the next owner can resume.
            if (reason !== 'handoff' && state.client) {
              for (const shardId of state.client.ws.shards.keys())
                sessions.update(shardId, null)
            }
            await sessions.close()
          },
        }
      },
    },
    {
      name: 'gateway',
      open: async () => {
        const discord = (options.createClient ?? createSapphireClient)(
          config,
          state.redis!,
          state.sessions!,
        )
        container.app = services
        state.client = discord
        try {
          await discord.login(config.discordToken)
        } catch (error) {
          await discord.destroy().catch(() => undefined)
          state.client = undefined
          throw error
        }
        return {
          close: async (reason: StopReason) => {
            try {
              if (reason === 'handoff') await stopGatewayForHandoff(discord)
            } finally {
              await discord.destroy()
            }
          },
        }
      },
    },
    {
      name: 'tasks',
      // Opened last so it closes first: the queue worker stops taking jobs
      // before the gateway and storage go away. Jobs in flight were admitted
      // through the work scope, so draining already waited for them.
      open: async () => ({
        close: async () => {
          await container.tasks?.close()
        },
      }),
    },
  )
  const runtime = new ApplicationRuntime(factories, config.drainTimeoutMs, work)
  return { runtime, services, client }
}
