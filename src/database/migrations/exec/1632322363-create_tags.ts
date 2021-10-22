import driver from '../../driver'

export async function up (db: typeof driver): Promise<void> {
  await db`
  CREATE TABLE tags (
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    guild BIGINT,
    owner BIGINT NOT NULL,
    content TEXT NOT NULL,
    PRIMARY KEY (name, guild)
  );`
  await db`CREATE INDEX tags_owner_idx ON tags (owner);`
  await db`CREATE INDEX tags_name_idx ON tags (name);`
  await db`CREATE INDEX tags_guild_idx ON tags (guild);`
}

export async function down (db: typeof driver): Promise<void> {
  await db`DROP TABLE IF EXISTS tags;`
}
