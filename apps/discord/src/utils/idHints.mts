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

/**
 * Application command ids live in Postgres, keyed by piece name, so
 * Sapphire can match existing commands across boots (and renames) instead
 * of recreating them. Individual commands never deal with idHints: the
 * traced base classes route registration through here.
 */

export async function fetchStoredIdHints(piece: Piece): Promise<string[]> {
  try {
    const rows = await db
      .select({ commandId: applicationCommandIds.commandId })
      .from(applicationCommandIds)
      .where(eq(applicationCommandIds.name, piece.name))
    return rows.map((row) => row.commandId.toString())
  } catch (error) {
    // Registration must survive the database being unreachable; Sapphire
    // falls back to matching by name.
    piece.container.logger.warn(
      `Could not load id hints for ${piece.name}, continuing without`,
      error,
    )
    return []
  }
}

/**
 * Wrap a registry so every register call carries the stored id hints,
 * merged with any the command supplies itself.
 */
export function withIdHints(
  registry: ApplicationCommandRegistry,
  hints: readonly string[],
): ApplicationCommandRegistry {
  if (hints.length === 0) return registry

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

/**
 * Replace a command's `registerApplicationCommands` with one that first
 * loads the stored hints and hands the subclass a hint-injecting registry.
 * Called from the traced base class constructors, so extending those is
 * all a new command needs to do.
 */
export function installIdHintTracking(command: Command): void {
  const registerApplicationCommands =
    command.registerApplicationCommands?.bind(command)
  if (!registerApplicationCommands) return

  command.registerApplicationCommands = async (registry) =>
    registerApplicationCommands(
      withIdHints(registry, await fetchStoredIdHints(command)),
    )
}

/**
 * Persist the ids Discord assigned during this boot's registry sync.
 * Runs after every sync: stale rows for a piece are dropped and current
 * ids upserted, so renamed or re-scoped commands self-heal.
 */
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
        // Every cluster syncs registries at boot; concurrent writers all
        // insert the same rows, so conflicts are not errors.
        await tx
          .insert(applicationCommandIds)
          .values(rows)
          .onConflictDoNothing()
      }
    })
  }
}
