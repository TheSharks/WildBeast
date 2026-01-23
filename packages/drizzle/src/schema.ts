import { bigint, pgTable, serial, text, unique } from 'drizzle-orm/pg-core'

export const tags = pgTable(
  'Tag',
  {
    id: serial('id').primaryKey(),
    name: text('name').notNull().unique(),
    content: text('content').notNull(),
    authorId: bigint('authorId', { mode: 'number' }).notNull(),
  },
  (table) => [unique('Tag_name_key').on(table.name)],
)

export const guilds = pgTable('Guild', {
  id: bigint('id', { mode: 'number' }).primaryKey(),
})

export type Tag = typeof tags.$inferSelect
export type NewTag = typeof tags.$inferInsert

export type Guild = typeof guilds.$inferSelect
export type NewGuild = typeof guilds.$inferInsert
