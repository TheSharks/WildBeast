import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema.js'

type Database = ReturnType<typeof drizzle<typeof schema>>

let pool: Pool | undefined
let database: Database | undefined
// Shutdown generation: getDb() after closeDb() reopens a FRESH pool (same
// call-time env read), so warn — a silent reopen would mask shutdown leaks.
let closes = 0

/**
 * Lazy pg pool + client; reads DATABASE_URL at call time so env validation runs first.
 */
export function getDb(): Database {
  database ??= (() => {
    if (closes > 0) {
      console.warn(
        'getDb() called after closeDb(): opening a fresh pool; move the call before shutdown if this was unintentional',
      )
    }
    const connectionString = process.env.DATABASE_URL
    if (!connectionString) {
      throw new Error('DATABASE_URL is required (for example postgresql://...)')
    }
    pool = new Pool({ connectionString })
    return drizzle(pool, { schema })
  })()
  return database
}

/** Close pool for shutdown. */
export async function closeDb(): Promise<void> {
  const current = pool
  pool = undefined
  database = undefined
  closes += 1
  await current?.end()
}

/** Lazy client proxy; import never connects, first query creates pool. */
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
