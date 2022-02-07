import driver from '../../driver'

export async function up (db: typeof driver): Promise<void> {
  await db`DROP TABLE IF EXISTS analytics;`
}

export async function down (db: typeof driver): Promise<void> {
  await db`
    CREATE TABLE IF NOT EXISTS analytics (
      id UUID NOT NULL PRIMARY KEY,
      timestamp TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
      type INTEGER NOT NULL,
      guild_id BIGINT,
      user_id BIGINT NOT NULL,
      data JSONB NOT NULL,
      name TEXT NOT NULL
    );
  `
}
