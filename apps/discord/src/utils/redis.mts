import { Redis } from 'ioredis'
import type { Env } from '../env.mjs'

export interface RedisConnectionOptions {
  host: string
  port: number
  /** ACL username from REDIS_URL (ioredis `username` option); absent means the default user. */
  username?: string
  password?: string
  db?: number
  /** Unix socket path. */
  path?: string
  /** Set for rediss:// for TLS. */
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
  // Redis allows up to 16383 databases with `databases` configured (default 16).
  const db = typeof raw === 'number' ? raw : Number.parseInt(String(raw), 10)
  if (!Number.isInteger(db) || db < 0 || db > 16_383) {
    throw new Error(
      `${source} must be an integer Redis database index 0-16383, got ${JSON.stringify(raw)}`,
    )
  }
  return db
}

/**
 * Resolve ioredis options from Env or process.env; REDIS_URL overrides parts, else localhost:6379 with range-checked ports/DB.
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

    // REDIS_URL is wholly authoritative: credentials/host/port/db come from
    // the URL alone (it overrides the parts), so the parts are ignored here.
    const username = url.username ? decodeURIComponent(url.username) : undefined
    const urlPassword = url.password
      ? decodeURIComponent(url.password)
      : undefined

    if (url.protocol === 'unix:') {
      const path = url.pathname || undefined
      if (!path) {
        throw new Error(
          `REDIS_URL unix:// must include a socket path, got ${JSON.stringify(redisUrl)}`,
        )
      }
      // unix:// ?db=N only; REDIS_DB is ignored while REDIS_URL is set.
      const queryDb = url.searchParams.get('db')
      return {
        host: 'localhost',
        port: 6379,
        ...(username ? { username } : {}),
        ...(urlPassword ? { password: urlPassword } : {}),
        ...(queryDb !== null ? { db: parseDb(queryDb, 'REDIS_URL ?db') } : {}),
        path,
      }
    }

    const hostname = url.hostname
    const host =
      (hostname.startsWith('[') && hostname.endsWith(']')
        ? hostname.slice(1, -1)
        : hostname) || 'localhost'
    const port = url.port ? parsePort(url.port, 'REDIS_URL port') : 6379
    // Path "/3" selects DB 3; REDIS_DB is ignored while REDIS_URL is set.
    const pathDb =
      url.pathname && url.pathname !== '/'
        ? url.pathname.slice(1).split('/')[0]
        : undefined
    const dbSource = pathDb !== undefined && pathDb !== '' ? pathDb : undefined

    return {
      host,
      port,
      ...(username ? { username } : {}),
      ...(urlPassword ? { password: urlPassword } : {}),
      ...(dbSource !== undefined
        ? { db: parseDb(dbSource, 'REDIS_URL path') }
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

/** One connection per shard worker (throttler + session store). */
export function getSharedWorkerRedis(env?: Env | NodeJS.ProcessEnv): Redis {
  sharedWorkerRedis ??= new Redis(redisConnectionOptions(env))
  return sharedWorkerRedis
}

/** Disconnect shared worker connection. */
export async function closeSharedWorkerRedis(): Promise<void> {
  const current = sharedWorkerRedis
  sharedWorkerRedis = undefined
  if (current) {
    current.disconnect()
  }
}
