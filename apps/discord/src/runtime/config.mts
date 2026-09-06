import type { Env } from '../env.mjs'
import type { Tier } from '../premium/model.mjs'
import { type PremiumSku, parsePremiumSkus } from '../premium/skus.mjs'
import { epochKeyPrefix } from '../sharding/epochs.mjs'
import { identifyKeyPrefix } from '../sharding/identifyThrottler.mjs'
import {
  type RedisConnectionOptions,
  redisConnectionOptions,
} from '../utils/redis.mjs'

export interface FlagConfig {
  url?: string
  token?: string
  cacheTtlMs: number
}

export interface ScheduleConfig {
  /** A completed snapshot older than this cannot justify background revocation. */
  entitlementStaleAfterMs: number
}

/** Everything the runtime and services read; nothing reads process.env after this. */
export interface AppConfig {
  environment: string
  development: boolean
  trace: boolean
  discordToken: string
  databaseUrl: string
  redis: RedisConnectionOptions
  /** SKU id to the tier an active grant confers. */
  premiumSkus: ReadonlyMap<bigint, Tier>
  /** Declared SKU catalog, for choosing what to sell in an upsell. */
  premiumCatalog: ReadonlyMap<string, PremiumSku>
  devGuildId: bigint | null
  ownerIds: ReadonlySet<bigint>
  /** Guilds that always receive operator commands, regardless of the runtime setting. */
  operatorGuildIds: ReadonlySet<bigint>
  inviteOverride?: string
  flags: FlagConfig
  clusterId?: string
  shardId?: string
  /** Shard ids this worker serves; empty when discord.js decides. */
  shardIds: readonly number[]
  sessionKeyPrefix: string
  identifyKeyPrefix: string
  schedules: ScheduleConfig
  drainTimeoutMs: number
}

export interface ConfigOverrides {
  shardId?: string
  shardIds?: readonly number[]
  clusterId?: string
}

export const DEFAULT_SCHEDULES: ScheduleConfig = {
  entitlementStaleAfterMs: 24 * 60 * 60 * 1000,
}

export function parseShardIds(raw: string | undefined): number[] {
  if (!raw) return []
  const ids = raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map(Number)
  if (ids.some((id) => !Number.isInteger(id) || id < 0)) {
    throw new Error(`Invalid shard list: ${raw}`)
  }
  return ids
}

export function configFromEnv(
  env: Env,
  overrides: ConfigOverrides = {},
): AppConfig {
  const catalog = parsePremiumSkus(env.WILDBEAST_PREMIUM_SKUS)
  const skus = new Map<bigint, Tier>()
  for (const [skuId, sku] of catalog) skus.set(BigInt(skuId), sku.tier)
  const ttlSeconds = env.WILDBEAST_OFREP_CACHE_TTL ?? 30
  const environment = env.NODE_ENV ?? 'development'
  const clusterId = overrides.clusterId ?? env.WILDBEAST_CLUSTER_ID
  return {
    environment,
    development: environment === 'development',
    trace: Boolean(env.TRACE),
    discordToken: env.DISCORD_TOKEN,
    databaseUrl: env.DATABASE_URL,
    redis: redisConnectionOptions(env),
    premiumSkus: skus,
    premiumCatalog: catalog,
    devGuildId: env.WILDBEAST_DEV_GUILD_ID
      ? BigInt(env.WILDBEAST_DEV_GUILD_ID)
      : null,
    ownerIds: new Set(
      (env.WILDBEAST_OWNER_IDS ?? '')
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean)
        .map(BigInt),
    ),
    operatorGuildIds: new Set(
      (env.WILDBEAST_OPERATOR_GUILD_IDS ?? '')
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean)
        .map(BigInt),
    ),
    ...(env.WILDBEAST_INVITE_OVERRIDE
      ? { inviteOverride: env.WILDBEAST_INVITE_OVERRIDE }
      : {}),
    flags: {
      ...(env.WILDBEAST_OFREP_URL ? { url: env.WILDBEAST_OFREP_URL } : {}),
      ...(env.WILDBEAST_OFREP_TOKEN
        ? { token: env.WILDBEAST_OFREP_TOKEN }
        : {}),
      cacheTtlMs: ttlSeconds * 1000,
    },
    ...(clusterId ? { clusterId } : {}),
    ...(overrides.shardId !== undefined ? { shardId: overrides.shardId } : {}),
    shardIds: overrides.shardIds ?? parseShardIds(overrides.shardId),
    sessionKeyPrefix:
      env.WILDBEAST_EPOCH !== undefined
        ? epochKeyPrefix(env.WILDBEAST_EPOCH)
        : env.WILDBEAST_SHARDING_TOTAL !== undefined
          ? `wildbeast:static:${env.WILDBEAST_SHARDING_TOTAL}`
          : 'wildbeast:static:auto',
    identifyKeyPrefix: identifyKeyPrefix(env.DISCORD_TOKEN, undefined),
    schedules: DEFAULT_SCHEDULES,
    drainTimeoutMs: 10_000,
  }
}
