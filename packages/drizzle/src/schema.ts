import {
  bigint,
  customType,
  index,
  pgTable,
  serial,
  text,
  unique,
} from 'drizzle-orm/pg-core'

/**
 * Case-insensitive text from the citext extension: comparisons and unique
 * constraints ignore case at the type level.
 */
const citext = customType<{ data: string }>({
  dataType() {
    return 'citext'
  },
})

export const tags = pgTable(
  'Tag',
  {
    id: serial('id').primaryKey(),
    name: citext('name').notNull(),
    content: text('content').notNull(),
    // Discord snowflakes exceed Number.MAX_SAFE_INTEGER, so they must map
    // to JS BigInt rather than number.
    authorId: bigint('authorId', { mode: 'bigint' }).notNull(),
  },
  (table) => [
    unique('Tag_name_key').on(table.name),
    // Trigram index (pg_trgm) backing substring autocomplete and
    // similarity() suggestions.
    index('Tag_name_trgm_idx').using('gin', table.name.op('gin_trgm_ops')),
  ],
)

export const guilds = pgTable('Guild', {
  id: bigint('id', { mode: 'bigint' }).primaryKey(),
})

/**
 * Application command ids as Discord assigned them, keyed back to the
 * Sapphire piece that registered them. Fed to the command registry as
 * idHints on the next boot so commands are updated instead of recreated.
 */
export const applicationCommandIds = pgTable(
  'ApplicationCommandId',
  {
    // Discord's command id; snowflakes exceed Number.MAX_SAFE_INTEGER.
    commandId: bigint('commandId', { mode: 'bigint' }).primaryKey(),
    // The Sapphire piece name (registry key), not the localized command name.
    name: text('name').notNull(),
    // Null for globally registered commands.
    guildId: bigint('guildId', { mode: 'bigint' }),
  },
  (table) => [index('ApplicationCommandId_name_idx').on(table.name)],
)

export type Tag = typeof tags.$inferSelect
export type NewTag = typeof tags.$inferInsert

export type Guild = typeof guilds.$inferSelect
export type NewGuild = typeof guilds.$inferInsert

export type ApplicationCommandId = typeof applicationCommandIds.$inferSelect
export type NewApplicationCommandId = typeof applicationCommandIds.$inferInsert
