import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'

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
  WILDBEAST_CLUSTER_ID: z.string().optional(),
  WILDBEAST_CLUSTERING_MODE: z.enum(['static', 'autonomous']).optional(),
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
