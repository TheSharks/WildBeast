import {
  bigint,
  boolean,
  customType,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
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
    // Tags are namespaced per guild: names only collide within one guild.
    guildId: bigint('guildId', { mode: 'bigint' }).notNull(),
    name: citext('name').notNull(),
    content: text('content').notNull(),
    // Discord snowflakes exceed Number.MAX_SAFE_INTEGER, so they must map
    // to JS BigInt rather than number.
    authorId: bigint('authorId', { mode: 'bigint' }).notNull(),
  },
  (table) => [
    unique('Tag_guildId_name_key').on(table.guildId, table.name),
    // Trigram index (pg_trgm) backing substring autocomplete and
    // similarity() suggestions; queries always filter by guild first.
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

/**
 * Discord entitlements (premium app subscriptions) as delivered by the
 * gateway, mirrored locally so premium checks work outside interactions
 * (scheduled tasks, background jobs) without hitting the API. Rows are
 * upserted by the entitlement listeners and reconciled on boot; interaction
 * handlers should prefer `interaction.entitlements`, which is always fresh.
 */
export const entitlements = pgTable(
  'Entitlement',
  {
    // Discord's entitlement id; snowflakes exceed Number.MAX_SAFE_INTEGER.
    id: bigint('id', { mode: 'bigint' }).primaryKey(),
    skuId: bigint('skuId', { mode: 'bigint' }).notNull(),
    // Exactly one of userId/guildId is set, depending on whether the SKU is
    // a user or a guild subscription.
    userId: bigint('userId', { mode: 'bigint' }),
    guildId: bigint('guildId', { mode: 'bigint' }),
    // Discord's EntitlementType (purchase, subscription, test, ...).
    type: integer('type').notNull(),
    // Discord soft-deletes entitlements (refunds, test cleanup); keeping the
    // flag mirrors their model and preserves history.
    deleted: boolean('deleted').notNull().default(false),
    // Null bounds mean a perpetual entitlement (e.g. test entitlements).
    startsAt: timestamp('startsAt', { withTimezone: true }),
    endsAt: timestamp('endsAt', { withTimezone: true }),
  },
  (table) => [
    index('Entitlement_guildId_idx').on(table.guildId),
    index('Entitlement_userId_idx').on(table.userId),
  ],
)

export type Tag = typeof tags.$inferSelect
export type NewTag = typeof tags.$inferInsert

export type Guild = typeof guilds.$inferSelect
export type NewGuild = typeof guilds.$inferInsert

export type ApplicationCommandId = typeof applicationCommandIds.$inferSelect
export type NewApplicationCommandId = typeof applicationCommandIds.$inferInsert

export type Entitlement = typeof entitlements.$inferSelect
export type NewEntitlement = typeof entitlements.$inferInsert
