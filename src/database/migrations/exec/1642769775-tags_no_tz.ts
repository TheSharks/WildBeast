import driver from '../../driver'

export async function up (db: typeof driver): Promise<void> {
  await db`ALTER TABLE tags ALTER COLUMN created_at SET DATA TYPE TIMESTAMP WITHOUT TIME ZONE`
  await db`ALTER TABLE tags ALTER COLUMN updated_at SET DATA TYPE TIMESTAMP WITHOUT TIME ZONE`
}

export async function down (db: typeof driver): Promise<void> {
  await db`ALTER TABLE tags ALTER COLUMN created_at SET DATA TYPE TIMESTAMP`
  await db`ALTER TABLE tags ALTER COLUMN updated_at SET DATA TYPE TIMESTAMP`
}
