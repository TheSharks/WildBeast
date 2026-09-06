import {
  and,
  asc,
  count,
  type createDatabase,
  eq,
  type getDb,
  ilike,
  isNotNull,
  or,
  sql,
  tagCommandIntents,
  tags,
} from '@thesharks/drizzle'
import type { CommandIntent, GuildTags, TagRepository } from '../tags/model.mjs'

type Database = ReturnType<typeof getDb>
type Connection = Pick<ReturnType<typeof createDatabase>, 'db' | 'withSession'>

export class PostgresTags implements TagRepository {
  public constructor(private readonly connection: Connection) {}

  public async withGuild<T>(
    guildId: bigint,
    work: (tags: GuildTags) => Promise<T>,
  ): Promise<T> {
    return this.connection.withSession(async (session) => {
      // Same key as the baseline runtime's transaction lock. Reserving a
      // connection lets intent writes commit before REST without losing the lock.
      await session.execute(
        sql`SELECT pg_advisory_lock(hashtextextended(${guildId.toString()}, 0))`,
      )
      try {
        return await work(new PostgresGuildTags(session, guildId))
      } finally {
        await session.execute(
          sql`SELECT pg_advisory_unlock(hashtextextended(${guildId.toString()}, 0))`,
        )
      }
    })
  }

  public async find(guildId: bigint, name: string) {
    return this.connection.db.query.tags.findFirst({
      where: and(eq(tags.guildId, guildId), eq(tags.name, name)),
    })
  }

  public async byCommand(guildId: bigint, commandId: bigint) {
    return this.connection.db.query.tags.findFirst({
      where: and(eq(tags.guildId, guildId), eq(tags.commandId, commandId)),
    })
  }

  public async list(guildId: bigint, authorId?: bigint) {
    return this.connection.db
      .select()
      .from(tags)
      .where(
        and(
          eq(tags.guildId, guildId),
          authorId === undefined ? undefined : eq(tags.authorId, authorId),
        ),
      )
      .orderBy(asc(tags.name))
      .limit(100)
  }

  public async search(guildId: bigint, text: string, promotedOnly: boolean) {
    const pattern = `%${text.replace(/[\\%_]/g, '\\$&')}%`
    const rows = await this.connection.db
      .select({ name: tags.name })
      .from(tags)
      .where(
        and(
          eq(tags.guildId, guildId),
          or(ilike(tags.name, pattern), sql`${tags.name} % ${text}`),
          promotedOnly ? isNotNull(tags.commandId) : undefined,
        ),
      )
      .orderBy(sql`similarity(${tags.name}, ${text}) DESC`, asc(tags.name))
      .limit(25)
    return rows.map((row) => row.name)
  }

  public async suggest(guildId: bigint, text: string) {
    const [match] = await this.connection.db
      .select({ name: tags.name })
      .from(tags)
      .where(
        and(
          eq(tags.guildId, guildId),
          sql`similarity(${tags.name}, ${text}) > 0.3`,
        ),
      )
      .orderBy(sql`similarity(${tags.name}, ${text}) DESC`, asc(tags.name))
      .limit(1)
    return match?.name
  }

  public async guildsWithIntents() {
    return (
      await this.connection.db
        .selectDistinct({ guildId: tagCommandIntents.guildId })
        .from(tagCommandIntents)
    ).map((row) => row.guildId)
  }
}

class PostgresGuildTags implements GuildTags {
  public constructor(
    private readonly database: Database,
    private readonly guildId: bigint,
  ) {}

  private tag(id: number) {
    return and(eq(tags.guildId, this.guildId), eq(tags.id, id))
  }
  private intent(id: number) {
    return and(
      eq(tagCommandIntents.guildId, this.guildId),
      eq(tagCommandIntents.id, id),
    )
  }

  public async find(name: string) {
    return this.database.query.tags.findFirst({
      where: and(eq(tags.guildId, this.guildId), eq(tags.name, name)),
    })
  }
  public async count() {
    const [result] = await this.database
      .select({ value: count() })
      .from(tags)
      .where(eq(tags.guildId, this.guildId))
    return result?.value ?? 0
  }
  public async create(input: {
    name: string
    content: string
    authorId: bigint
  }) {
    const [tag] = await this.database
      .insert(tags)
      .values({ ...input, guildId: this.guildId })
      .onConflictDoNothing({ target: [tags.guildId, tags.name] })
      .returning()
    return tag
  }
  public async edit(id: number, content: string) {
    await this.database.update(tags).set({ content }).where(this.tag(id))
  }
  public async remove(id: number) {
    await this.database.transaction(async (tx) => {
      await tx
        .update(tagCommandIntents)
        .set({ wanted: false })
        .where(
          and(
            eq(tagCommandIntents.guildId, this.guildId),
            eq(tagCommandIntents.tagId, id),
          ),
        )
      await tx.delete(tags).where(this.tag(id))
    })
  }
  public async intents() {
    return this.database
      .select()
      .from(tagCommandIntents)
      .where(eq(tagCommandIntents.guildId, this.guildId))
      .orderBy(asc(tagCommandIntents.requestedAt), asc(tagCommandIntents.id))
  }
  public async request(
    input: Omit<
      CommandIntent,
      'id' | 'guildId' | 'commandId' | 'attempted' | 'wanted'
    >,
  ) {
    await this.database
      .insert(tagCommandIntents)
      .values({ ...input, guildId: this.guildId })
      .onConflictDoUpdate({
        target: [tagCommandIntents.guildId, tagCommandIntents.name],
        set: { ...input, wanted: true },
      })
  }
  public async withdraw(id: number) {
    await this.database
      .update(tagCommandIntents)
      .set({ wanted: false })
      .where(this.intent(id))
  }
  public async markAttempted(id: number) {
    await this.database
      .update(tagCommandIntents)
      .set({ attempted: true })
      .where(this.intent(id))
  }
  public async bind(intent: CommandIntent, commandId: bigint) {
    await this.database.transaction(async (tx) => {
      await tx
        .update(tagCommandIntents)
        .set({ commandId, attempted: true })
        .where(this.intent(intent.id))
      if (intent.tagId !== null && intent.wanted) {
        await tx
          .update(tags)
          .set({
            commandId,
            commandDescription: intent.description,
            promotedBy: intent.requestedBy,
            promotedAt: intent.requestedAt,
          })
          .where(this.tag(intent.tagId))
      }
    })
  }
  public async forget(intent: CommandIntent) {
    await this.database.transaction(async (tx) => {
      if (intent.tagId !== null) {
        await tx
          .update(tags)
          .set({
            commandId: null,
            commandDescription: null,
            promotedBy: null,
            promotedAt: null,
          })
          .where(this.tag(intent.tagId))
      }
      await tx.delete(tagCommandIntents).where(this.intent(intent.id))
    })
  }
}
