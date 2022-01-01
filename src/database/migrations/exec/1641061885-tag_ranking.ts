import driver from '../../driver'

export async function up (db: typeof driver): Promise<void> {
  await db`ALTER TABLE tags ADD COLUMN uses BIGINT NOT NULL DEFAULT 0;`
  await db`CREATE INDEX tags_uses_idx ON tags (uses);`
}

export async function down (db: typeof driver): Promise<void> {
  await db`ALTER TABLE tags DROP COLUMN uses;`
  await db`DROP INDEX tags_uses_idx;`
}
