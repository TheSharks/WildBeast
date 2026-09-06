import { readFile } from 'node:fs/promises'
import { expect, it } from 'vitest'

it.skipIf(!process.env.DATABASE_URL)(
  'upgrades legacy entitlement owners before adding the CHECK',
  async () => {
    const { db, sql } = await import('@thesharks/drizzle')
    const migration = await readFile(
      new URL(
        '../../../packages/drizzle/drizzle/0006_minor_pepper_potts.sql',
        import.meta.url,
      ),
      'utf8',
    )
    await db.transaction(async (tx) => {
      // A temporary table shadows the mirror without changing persistent data.
      await tx.execute(
        sql.raw(`CREATE TEMP TABLE "Entitlement" (
      id bigint PRIMARY KEY, "userId" bigint, "guildId" bigint
    ) ON COMMIT DROP`),
      )
      await tx.execute(
        sql.raw(`INSERT INTO "Entitlement" VALUES
      (1, 10, 20), (2, NULL, NULL), (3, 30, NULL), (4, NULL, 40)`),
      )
      for (const statement of migration.split('--> statement-breakpoint')) {
        await tx.execute(sql.raw(statement))
      }
      const result = await tx.execute(
        sql.raw('SELECT * FROM "Entitlement" ORDER BY id'),
      )
      expect(result.rows).toMatchObject([
        { id: '1', userId: null, guildId: '20' },
        { id: '3', userId: '30', guildId: null },
        { id: '4', userId: null, guildId: '40' },
      ])
      await tx.execute(sql.raw('SAVEPOINT invalid_owner'))
      await expect(
        tx.execute(sql.raw('INSERT INTO "Entitlement" (id) VALUES (5)')),
      ).rejects.toThrow()
      await tx.execute(sql.raw('ROLLBACK TO SAVEPOINT invalid_owner'))
    })
  },
)
