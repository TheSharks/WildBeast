import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema.js'

type Database = NodePgDatabase<typeof schema>

/** Explicit connection ownership for application composition and isolated tests. */
export function createDatabase(connectionString: string) {
  if (!connectionString)
    throw new Error('Database connection string is required')
  const ownedPool = new Pool({ connectionString })
  const db = drizzle(ownedPool, { schema })
  let closing: Promise<void> | undefined
  return {
    db,
    close: () => (closing ??= ownedPool.end()),
    /** Reserve a connection for session advisory locks; discard it on failure. */
    withSession: async <T>(
      work: (session: Database) => Promise<T>,
    ): Promise<T> => {
      const client = await ownedPool.connect()
      try {
        const result = await work(drizzle(client, { schema }))
        client.release()
        return result
      } catch (error) {
        client.release(true)
        throw error
      }
    },
  }
}

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
