import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'
import { parsePremiumSkus } from './premium/skus.mjs'

/**
 * Shape of the environment WildBeast cares about. Unknown variables pass
 * through untouched; empty strings are treated as absent (a commented-out
 * or blank line in .env must not count as a value).
 */
export const envSchema = z.object({
  DISCORD_TOKEN: z
    .string()
    .min(1, 'DISCORD_TOKEN (or its legacy alias BOT_TOKEN) is required'),
  NODE_ENV: z.string().optional(),
  TRACE: z.string().optional(),
  REDIS_HOST: z.string().optional(),
  REDIS_PORT: z.coerce.number().int().min(1).max(65_535).optional(),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.coerce.number().int().nonnegative().optional(),
  SENTRY_DSN: z.url().optional(),
  SENTRY_PROFILE_SESSION_SAMPLE_RATE: z.coerce
    .number()
    .min(0)
    .max(1)
    .optional(),
  WILDBEAST_CLUSTER_ID: z.string().optional(),
  WILDBEAST_CLUSTERING_MODE: z.enum(['static', 'autonomous']).optional(),
  // When set, commands register in this guild instead of globally, so
  // development iterations show up instantly.
  WILDBEAST_DEV_GUILD_ID: z.string().regex(/^\d+$/).optional(),
  // Shown by /invite instead of the generated OAuth URL when set.
  WILDBEAST_INVITE_OVERRIDE: z.url().optional(),
  // Comma-separated `skuId:tier` or `skuId:tier:scope` entries mapping the
  // app's monetization SKUs to premium tiers, with scope (user/guild)
  // matching the kind of subscription the SKU is sold as, e.g.
  // "1315790123456789:premium:guild". Unset means premium is off:
  // everything runs at the free tier.
  WILDBEAST_PREMIUM_SKUS: z
    .string()
    .optional()
    .superRefine((value, ctx) => {
      if (value === undefined) return
      try {
        parsePremiumSkus(value)
      } catch (error) {
        ctx.addIssue({ code: 'custom', message: (error as Error).message })
      }
    }),
  // Base URL of an OFREP-compatible feature flag service (flagd, GO
  // Feature Flag, ...). Optional: without it, command/task gates,
  // experiments and remote limit overrides use their in-code defaults.
  WILDBEAST_OFREP_URL: z.url().optional(),
  // Bearer token sent to the OFREP service, for providers that need auth.
  WILDBEAST_OFREP_TOKEN: z.string().optional(),
  WILDBEAST_SHARDING_START: z.coerce.number().int().nonnegative().optional(),
  WILDBEAST_SHARDING_END: z.coerce.number().int().nonnegative().optional(),
  WILDBEAST_SHARDING_TOTAL: z.coerce.number().int().positive().optional(),
})

export type Env = z.infer<typeof envSchema>

/**
 * Validate an environment. Range/mode semantics of the sharding variables
 * are validated separately by `parseClusteringConfig`; this gate covers
 * presence and shape so misconfiguration fails at boot with a readable
 * message instead of deep inside discord.js or ioredis.
 */
export function validateEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const candidate: Record<string, string | undefined> = {
    ...source,
    // v8 configurations used BOT_TOKEN.
    DISCORD_TOKEN: source.DISCORD_TOKEN ?? source.BOT_TOKEN,
  }
  for (const [key, value] of Object.entries(candidate)) {
    if (value === '') {
      delete candidate[key]
    }
  }

  const result = envSchema.safeParse(candidate)
  if (!result.success) {
    throw new Error(`Invalid environment:\n${z.prettifyError(result.error)}`)
  }
  return result.data
}

/**
 * Load the app's .env file (when present) into process.env and validate the
 * result. Called once by the cluster manager before anything else; workers
 * inherit the already-validated environment.
 */
export function loadEnv(): Env {
  try {
    process.loadEnvFile(
      resolve(dirname(fileURLToPath(import.meta.url)), '../.env'),
    )
  } catch (error) {
    // No .env file is fine: production environments inject real env vars.
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error
    }
  }

  const env = validateEnv()
  // Make the resolved token canonical for everything downstream
  // (ShardingManager, workers via shared env).
  process.env.DISCORD_TOKEN = env.DISCORD_TOKEN
  return env
}
