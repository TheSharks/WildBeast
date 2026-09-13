import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema.js'

export type Database = NodePgDatabase<typeof schema>

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
