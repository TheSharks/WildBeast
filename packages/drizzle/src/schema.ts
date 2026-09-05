import { sql } from 'drizzle-orm'
import {
  bigint,
  boolean,
  check,
  customType,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

/** Case-insensitive text (citext): comparisons/uniques ignore case. */
const citext = customType<{ data: string }>({
  dataType() {
    return 'citext'
  },
})

export const tags = pgTable(
  'Tag',
  {
    id: serial('id').primaryKey(),
    // Per-guild namespace.
    guildId: bigint('guildId', { mode: 'bigint' }).notNull(),
    name: citext('name').notNull(),
    content: text('content').notNull(),
    // Snowflakes exceed MAX_SAFE_INTEGER; use BigInt.
    authorId: bigint('authorId', { mode: 'bigint' }).notNull(),
    // Discord-assigned id when promoted; null when not.
    commandId: bigint('commandId', { mode: 'bigint' }),
    // Promotion description for verbatim reconcile.
    commandDescription: text('commandDescription'),
    promotedBy: bigint('promotedBy', { mode: 'bigint' }),
    promotedAt: timestamp('promotedAt', { withTimezone: true }),
  },
  (table) => [
    unique('Tag_guildId_name_key').on(table.guildId, table.name),
    // Trigram index for substring autocomplete/suggestions (guild-scoped).
    index('Tag_name_trgm_idx').using('gin', table.name.op('gin_trgm_ops')),
    uniqueIndex('Tag_commandId_key').on(table.commandId),
    // Promoted-only index keeps cap/reconcile scans small.
    index('Tag_promoted_guildId_idx')
      .on(table.guildId)
      .where(sql`"commandId" IS NOT NULL`),
  ],
)

export const guilds = pgTable('Guild', {
  id: bigint('id', { mode: 'bigint' }).primaryKey(),
})

/** Command ids keyed by Sapphire piece; fed as idHints to avoid recreates. */
export const applicationCommandIds = pgTable(
  'ApplicationCommandId',
  {
    // Snowflake; exceeds MAX_SAFE_INTEGER.
    commandId: bigint('commandId', { mode: 'bigint' }).primaryKey(),
    // Sapphire piece name, not localized command name.
    name: text('name').notNull(),
    // Null for global commands.
    guildId: bigint('guildId', { mode: 'bigint' }),
  },
  (table) => [index('ApplicationCommandId_name_idx').on(table.name)],
)

/** Discord entitlements mirrored for non-interaction checks; Discord is source of truth, no FKs. */
export const entitlements = pgTable(
  'Entitlement',
  {
    // Snowflake; exceeds MAX_SAFE_INTEGER.
    id: bigint('id', { mode: 'bigint' }).primaryKey(),
    skuId: bigint('skuId', { mode: 'bigint' }).notNull(),
    // Exactly one of userId/guildId is set (CHECK); guild subs arrive with both, mirror keeps guild-only.
    userId: bigint('userId', { mode: 'bigint' }),
    guildId: bigint('guildId', { mode: 'bigint' }),
    // Discord EntitlementType.
    type: integer('type').notNull(),
    // Mirrors Discord soft-delete; preserves history.
    deleted: boolean('deleted').notNull().default(false),
    // Null bounds mean perpetual (e.g. test entitlements).
    startsAt: timestamp('startsAt', { withTimezone: true }),
    endsAt: timestamp('endsAt', { withTimezone: true }),
    // Last write; defaults to now() for backfills.
    updatedAt: timestamp('updatedAt', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('Entitlement_guildId_idx').on(table.guildId),
    index('Entitlement_userId_idx').on(table.userId),
    check(
      'Entitlement_user_or_guild_check',
      sql`(("userId" IS NULL) <> ("guildId" IS NULL))`,
    ),
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
