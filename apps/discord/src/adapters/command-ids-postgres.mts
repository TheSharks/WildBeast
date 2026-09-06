import type { ApplicationCommandRegistry } from '@sapphire/framework'
import {
  and,
  applicationCommandIds,
  eq,
  type getDb,
  type NewApplicationCommandId,
} from '@thesharks/drizzle'

export interface CommandIdRepository {
  hintsFor(pieceName: string): Promise<string[]>
  /** Replace the rows of every registry given; other names are untouched. */
  persist(registries: Map<string, ApplicationCommandRegistry>): Promise<void>
  placements(
    name: string,
  ): Promise<Array<{ guildId: bigint; commandId: bigint }>>
  record(name: string, guildId: bigint, commandId: bigint): Promise<void>
  forget(name: string, guildId: bigint): Promise<void>
}

/** Command ids by piece name, so boots match instead of recreating. */
type Database = ReturnType<typeof getDb>

export class PostgresCommandIds implements CommandIdRepository {
  private readonly database: () => Database

  public constructor(database: Database | (() => Database)) {
    this.database = typeof database === 'function' ? database : () => database
  }

  public async hintsFor(pieceName: string): Promise<string[]> {
    const rows = await this.database()
      .select({ commandId: applicationCommandIds.commandId })
      .from(applicationCommandIds)
      .where(eq(applicationCommandIds.name, pieceName))
    return rows.map((row) => row.commandId.toString())
  }

  public async placements(name: string) {
    const rows = await this.database()
      .select({
        guildId: applicationCommandIds.guildId,
        commandId: applicationCommandIds.commandId,
      })
      .from(applicationCommandIds)
      .where(eq(applicationCommandIds.name, name))
    return rows.flatMap((row) =>
      row.guildId === null
        ? []
        : [{ guildId: row.guildId, commandId: row.commandId }],
    )
  }

  public async record(name: string, guildId: bigint, commandId: bigint) {
    await this.database().transaction(async (tx) => {
      await tx
        .delete(applicationCommandIds)
        .where(
          and(
            eq(applicationCommandIds.name, name),
            eq(applicationCommandIds.guildId, guildId),
          ),
        )
      await tx
        .insert(applicationCommandIds)
        .values({ name, guildId, commandId })
        .onConflictDoNothing()
    })
  }

  public async forget(name: string, guildId: bigint) {
    await this.database()
      .delete(applicationCommandIds)
      .where(
        and(
          eq(applicationCommandIds.name, name),
          eq(applicationCommandIds.guildId, guildId),
        ),
      )
  }

  public async persist(
    registries: Map<string, ApplicationCommandRegistry>,
  ): Promise<void> {
    for (const [name, registry] of registries) {
      const rows: NewApplicationCommandId[] = []
      for (const id of registry.globalChatInputCommandIds)
        rows.push({ commandId: BigInt(id), name, guildId: null })
      for (const id of registry.globalContextMenuCommandIds)
        rows.push({ commandId: BigInt(id), name, guildId: null })
      for (const [guildId, ids] of registry.guildIdToChatInputCommandIds)
        for (const id of ids)
          rows.push({ commandId: BigInt(id), name, guildId: BigInt(guildId) })
      for (const [guildId, ids] of registry.guildIdToContextMenuCommandIds)
        for (const id of ids)
          rows.push({ commandId: BigInt(id), name, guildId: BigInt(guildId) })
      await this.database().transaction(async (tx) => {
        await tx
          .delete(applicationCommandIds)
          .where(eq(applicationCommandIds.name, name))
        if (rows.length > 0) {
          // Concurrent clusters insert identical rows; conflicts are not errors.
          await tx
            .insert(applicationCommandIds)
            .values(rows)
            .onConflictDoNothing()
        }
      })
    }
  }
}
