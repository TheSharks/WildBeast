import type {
  ApplicationCommandRegistry,
  Command,
  Piece,
} from '@sapphire/framework'
import {
  applicationCommandIds,
  db,
  eq,
  type NewApplicationCommandId,
} from '@thesharks/drizzle'

// Command ids in Postgres keyed by piece name, so boots match instead of recreating.

export async function fetchStoredIdHints(piece: Piece): Promise<string[]> {
  try {
    const rows = await db
      .select({ commandId: applicationCommandIds.commandId })
      .from(applicationCommandIds)
      .where(eq(applicationCommandIds.name, piece.name))
    return rows.map((row) => row.commandId.toString())
  } catch (error) {
    // Registration survives DB outages; Sapphire falls back to name matching.
    piece.container.logger.warn(
      `Could not load id hints for ${piece.name}, continuing without`,
      error,
    )
    return []
  }
}

// Registry carrying stored id hints; dev guild set means guild registration for instant updates.
export function withRegistrationDefaults(
  registry: ApplicationCommandRegistry,
  hints: readonly string[],
): ApplicationCommandRegistry {
  const devGuildId = process.env.WILDBEAST_DEV_GUILD_ID
  if (hints.length === 0 && !devGuildId) return registry

  return new Proxy(registry, {
    get(target, property, receiver) {
      if (
        property === 'registerChatInputCommand' ||
        property === 'registerContextMenuCommand'
      ) {
        return (
          command: never,
          options?: ApplicationCommandRegistry.RegisterOptions,
        ) => {
          target[property](command, {
            ...(devGuildId ? { guildIds: [devGuildId] } : {}),
            ...options,
            idHints: [...new Set([...(options?.idHints ?? []), ...hints])],
          })
          return receiver
        }
      }
      const value = Reflect.get(target, property, target)
      return typeof value === 'function' ? value.bind(target) : value
    },
  })
}

// Route a command's registration through stored id hints (wired by traced base classes).
export function installIdHintTracking(command: Command): void {
  const registerApplicationCommands =
    command.registerApplicationCommands?.bind(command)
  if (!registerApplicationCommands) return

  command.registerApplicationCommands = async (registry) =>
    registerApplicationCommands(
      withRegistrationDefaults(registry, await fetchStoredIdHints(command)),
    )
}

// Persist this boot's assigned ids; stale rows drop so renames self-heal.
export async function persistCommandIds(
  registries: Map<string, ApplicationCommandRegistry>,
): Promise<void> {
  for (const [name, registry] of registries) {
    const rows: NewApplicationCommandId[] = []
    for (const id of registry.globalChatInputCommandIds) {
      rows.push({ commandId: BigInt(id), name, guildId: null })
    }
    for (const id of registry.globalContextMenuCommandIds) {
      rows.push({ commandId: BigInt(id), name, guildId: null })
    }
    for (const [guildId, ids] of registry.guildIdToChatInputCommandIds) {
      for (const id of ids) {
        rows.push({ commandId: BigInt(id), name, guildId: BigInt(guildId) })
      }
    }
    for (const [guildId, ids] of registry.guildIdToContextMenuCommandIds) {
      for (const id of ids) {
        rows.push({ commandId: BigInt(id), name, guildId: BigInt(guildId) })
      }
    }

    await db.transaction(async (tx) => {
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
