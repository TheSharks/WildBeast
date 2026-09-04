import { Redis } from 'ioredis'
import type { Env } from '../env.mjs'

export interface RedisConnectionOptions {
  host: string
  port: number
  password?: string
  db?: number
  /** Unix socket path for unix:// URLs. */
  path?: string
  /** Set for rediss:// URLs so ioredis negotiates TLS. */
  tls?: Record<string, unknown>
}

function asText(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined
  const text = String(value).trim()
  return text === '' ? undefined : text
}

function parsePort(raw: unknown, source: string): number {
  const port = typeof raw === 'number' ? raw : Number.parseInt(String(raw), 10)
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(
      `${source} must be an integer port 1-65535, got ${JSON.stringify(raw)}`,
    )
  }
  return port
}

function parseDb(raw: unknown, source: string): number {
  const db = typeof raw === 'number' ? raw : Number.parseInt(String(raw), 10)
  if (!Number.isInteger(db) || db < 0 || db > 15) {
    throw new Error(
      `${source} must be an integer Redis database index 0-15, got ${JSON.stringify(raw)}`,
    )
  }
  return db
}

/**
 * Resolve ioredis connection options from a validated Env (preferred) or
 * the raw process environment. A full REDIS_URL (redis://, rediss:// or
 * unix://) overrides the REDIS_HOST/PORT/PASSWORD/DB parts when set;
 * otherwise those parts apply with localhost:6379 defaults. Ports and DB
 * indexes are range-checked so misconfiguration fails at boot instead of
 * deep inside ioredis.
 */
export function redisConnectionOptions(
  env?: Env | NodeJS.ProcessEnv,
): RedisConnectionOptions {
  const candidate = (env ?? process.env) as Record<string, unknown>
  const redisUrl = asText(candidate.REDIS_URL) ?? asText(process.env.REDIS_URL)
  const hostRaw = asText(candidate.REDIS_HOST) ?? asText(process.env.REDIS_HOST)
  const portRaw = candidate.REDIS_PORT ?? process.env.REDIS_PORT
  const passwordRaw =
    asText(candidate.REDIS_PASSWORD) ?? asText(process.env.REDIS_PASSWORD)
  const dbRaw = candidate.REDIS_DB ?? process.env.REDIS_DB

  if (redisUrl) {
    let url: URL
    try {
      url = new URL(redisUrl)
    } catch {
      throw new Error(
        `REDIS_URL must be a redis://, rediss:// or unix:// URL, got ${JSON.stringify(redisUrl)}`,
      )
    }
    if (
      url.protocol !== 'redis:' &&
      url.protocol !== 'rediss:' &&
      url.protocol !== 'unix:'
    ) {
      throw new Error(
        `REDIS_URL must be a redis://, rediss:// or unix:// URL, got ${JSON.stringify(redisUrl)}`,
      )
    }

    if (url.protocol === 'unix:') {
      const path = url.pathname || undefined
      if (!path) {
        throw new Error(
          `REDIS_URL unix:// must include a socket path, got ${JSON.stringify(redisUrl)}`,
        )
      }
      const password = url.password
        ? decodeURIComponent(url.password)
        : (passwordRaw ?? undefined)
      // A unix:// URL may carry ?db=N; otherwise fall back to REDIS_DB.
      const queryDb = url.searchParams.get('db')
      const dbSource =
        queryDb ?? (dbRaw !== undefined ? String(dbRaw) : undefined)
      return {
        host: 'localhost',
        port: 6379,
        ...(password ? { password } : {}),
        ...(dbSource !== undefined
          ? { db: parseDb(dbSource, 'REDIS_URL ?db / REDIS_DB') }
          : {}),
        path,
      }
    }

    const host = url.hostname || hostRaw || 'localhost'
    const port = url.port
      ? parsePort(url.port, 'REDIS_URL port')
      : portRaw !== undefined && asText(portRaw) !== undefined
        ? parsePort(portRaw, 'REDIS_PORT')
        : 6379
    const password = url.password
      ? decodeURIComponent(url.password)
      : (passwordRaw ?? undefined)
    // Path "/3" selects DB 3; otherwise REDIS_DB applies.
    const pathDb =
      url.pathname && url.pathname !== '/'
        ? url.pathname.slice(1).split('/')[0]
        : undefined
    const dbSource =
      pathDb !== undefined && pathDb !== ''
        ? pathDb
        : dbRaw !== undefined && asText(dbRaw) !== undefined
          ? dbRaw
          : undefined

    return {
      host,
      port,
      ...(password ? { password } : {}),
      ...(dbSource !== undefined
        ? { db: parseDb(dbSource, 'REDIS_URL path / REDIS_DB') }
        : {}),
      ...(url.protocol === 'rediss:' ? { tls: {} } : {}),
    }
  }

  const host = hostRaw || 'localhost'
  const port =
    portRaw !== undefined && asText(portRaw) !== undefined
      ? parsePort(portRaw, 'REDIS_PORT')
      : 6379
  const password = passwordRaw ?? undefined
  const db =
    dbRaw !== undefined && asText(dbRaw) !== undefined
      ? parseDb(dbRaw, 'REDIS_DB')
      : undefined

  return {
    host,
    port,
    ...(password ? { password } : {}),
    ...(db !== undefined ? { db } : {}),
  }
}

let sharedWorkerRedis: Redis | undefined

/**
 * One connection per shard worker, shared by the identify throttler and the
 * session store.
 */
export function getSharedWorkerRedis(env?: Env | NodeJS.ProcessEnv): Redis {
  sharedWorkerRedis ??= new Redis(redisConnectionOptions(env))
  return sharedWorkerRedis
}

/** Disconnect the shared worker connection, e.g. during shutdown. */
export async function closeSharedWorkerRedis(): Promise<void> {
  const current = sharedWorkerRedis
  sharedWorkerRedis = undefined
  if (current) {
    current.disconnect()
  }
}
