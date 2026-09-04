import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema.js'

type Database = ReturnType<typeof drizzle<typeof schema>>

let pool: Pool | undefined
let database: Database | undefined

/**
 * Lazily create the pg pool and Drizzle client on first use. Reads
 * DATABASE_URL at call time (not import time) so `validateEnv()`/`loadEnv()`
 * in the cluster manager always runs first and misconfiguration fails at
 * boot with a readable message instead of deep inside pg.
 *
 * Callers must ensure the environment was validated before the first call;
 * importing this module alone never connects.
 */
export function getDb(): Database {
  database ??= (() => {
    const connectionString = process.env.DATABASE_URL
    if (!connectionString) {
      throw new Error('DATABASE_URL is required (for example postgresql://...)')
    }
    pool = new Pool({ connectionString })
    return drizzle(pool, { schema })
  })()
  return database
}

/** Close the underlying pg pool, e.g. during graceful shutdown. */
export async function closeDb(): Promise<void> {
  const current = pool
  pool = undefined
  database = undefined
  await current?.end()
}

/**
 * Lazily-initialized client for application code. Property access forwards
 * to `getDb()`, so importing `{ db }` never opens a connection: the pool is
 * created on the first query and `closeDb()` resets it. Prefer `getDb()`
 * in new code where an explicit call reads better.
 */
export const db: Database = new Proxy({} as Database, {
  get(_target, property, receiver) {
    return Reflect.get(getDb() as object, property, receiver)
  },
  has(_target, property) {
    return Reflect.has(getDb() as object, property)
  },
  ownKeys(_target) {
    return Reflect.ownKeys(getDb() as object)
  },
  getOwnPropertyDescriptor(_target, property) {
    const descriptor = Reflect.getOwnPropertyDescriptor(
      getDb() as object,
      property,
    )
    if (descriptor) {
      descriptor.configurable = true
    }
    return descriptor
  },
})
