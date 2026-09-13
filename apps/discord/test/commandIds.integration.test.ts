import { readFile } from 'node:fs/promises'
import { applicationCommandIds, createDatabase, sql } from '@thesharks/drizzle'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { PostgresCommandIds } from '../src/adapters/command-ids-postgres.mjs'

// Run only against a disposable, migrated database.
const url = process.env.DATABASE_URL
describe.skipIf(!url)('operator placement ownership in PostgreSQL', () => {
  let connection: ReturnType<typeof createDatabase>
  let repository: PostgresCommandIds
  beforeAll(() => {
    connection = createDatabase(url!)
    repository = new PostgresCommandIds(connection.db)
  })
  beforeEach(async () => {
    await connection.db.delete(applicationCommandIds)
  })
  afterAll(async () => {
    await connection?.close()
  })

  it('backfills only the shipped operator command when upgrading existing rows', async () => {
    const migration = await readFile(
      new URL(
        '../../../packages/drizzle/drizzle/0012_operator-command-ownership.sql',
        import.meta.url,
      ),
      'utf8',
    )
    await connection.db.transaction(async (tx) => {
      await tx.execute(
        sql`CREATE TEMP TABLE "ApplicationCommandId" ("commandId" bigint PRIMARY KEY, "name" text NOT NULL, "guildId" bigint) ON COMMIT DROP`,
      )
      await tx.execute(
        sql`INSERT INTO pg_temp."ApplicationCommandId" VALUES (1, 'flags', 10), (2, 'flags', NULL), (3, 'ping', 10)`,
      )
      for (const statement of migration.split('--> statement-breakpoint'))
        await tx.execute(sql.raw(statement))
      const result = await tx.execute(
        sql`SELECT "commandId", "operator" FROM pg_temp."ApplicationCommandId" ORDER BY "commandId"`,
      )
      expect(result.rows).toEqual([
        { commandId: '1', operator: true },
        { commandId: '2', operator: false },
        { commandId: '3', operator: false },
      ])
    })
  })

  it('lists removed definitions without exposing ordinary guild commands', async () => {
    await connection.db.insert(applicationCommandIds).values([
      { name: 'deleted', commandId: 1n, guildId: 10n, operator: true },
      { name: 'ping', commandId: 2n, guildId: 10n },
      { name: 'deleted', commandId: 3n, guildId: 11n },
    ])
    expect(await repository.placements()).toEqual([
      { name: 'deleted', commandId: 1n, guildId: 10n },
    ])
    await repository.forget('deleted', 11n)
    expect(await repository.hintsFor('deleted')).toEqual(['3'])
    await repository.forget('deleted', 10n)
    expect(await repository.placements()).toEqual([])
    expect(await repository.hintsFor('ping')).toEqual(['2'])
  })

  it('keeps operator placements when Sapphire replaces a registry of the same name', async () => {
    await repository.record('flags', 10n, 1n)
    await repository.persist(
      new Map([
        [
          'flags',
          {
            globalChatInputCommandIds: new Set(['2']),
            globalContextMenuCommandIds: new Set(),
            guildIdToChatInputCommandIds: new Map(),
            guildIdToContextMenuCommandIds: new Map(),
          } as never,
        ],
      ]),
    )
    expect(await repository.placements()).toEqual([
      { name: 'flags', commandId: 1n, guildId: 10n },
    ])
    expect(await repository.hintsFor('flags')).toEqual(['2'])
    await repository.record('flags', 10n, 3n)
    expect(await repository.placements()).toEqual([
      { name: 'flags', commandId: 3n, guildId: 10n },
    ])
  })

  it('closing one database owner does not close another', async () => {
    const other = createDatabase(url!)
    const closing = other.close()
    expect(other.close()).toBe(closing)
    await closing
    await expect(repository.placements()).resolves.toEqual([])
  })
})
