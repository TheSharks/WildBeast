export const MIGRATIONS_CREATE =
`CREATE TABLE IF NOT EXISTS migrations (
  id SERIAL PRIMARY KEY,
  name VARCHAR NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);`

export const MIGRATIONS_CHECK_IF_EXISTS =
'SELECT name FROM migrations ORDER BY id ASC;'

export const MIGRATION_STEP_TEMPLATE =
`import driver from '../../driver'

export async function up (db: typeof driver): Promise<void> {
  // do something cool!
}

export async function down (db: typeof driver): Promise<void> {
  // just in case...
}
`
