import { Redis } from 'ioredis'

export interface RedisConnectionOptions {
  host: string
  port: number
  password?: string
  db?: number
}

export function redisConnectionOptions(): RedisConnectionOptions {
  return {
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
  }
}

let sharedWorkerRedis: Redis | undefined

/**
 * One connection per shard worker, shared by the identify throttler and the
 * session store.
 */
export function getSharedWorkerRedis(): Redis {
  sharedWorkerRedis ??= new Redis(redisConnectionOptions())
  return sharedWorkerRedis
}
