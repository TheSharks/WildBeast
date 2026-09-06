import type {
  RESTPostAPIChatInputApplicationCommandsJSONBody,
  RESTPostAPIContextMenuApplicationCommandsJSONBody,
} from 'discord.js'

export type OperatorCommandData =
  | RESTPostAPIChatInputApplicationCommandsJSONBody
  | RESTPostAPIContextMenuApplicationCommandsJSONBody

export interface OperatorCommandDefinition {
  /** Sapphire piece name; Sapphire dispatches by command name, so they must match. */
  name: string
  data: OperatorCommandData
}

/** Per-command REST only; bulk overwrites would wipe promoted tag commands. */
export interface OperatorCommandGateway {
  create(guildId: bigint, data: OperatorCommandData): Promise<bigint>
  /** Resolves false when Discord no longer knows the command. */
  update(
    guildId: bigint,
    commandId: bigint,
    data: OperatorCommandData,
  ): Promise<boolean>
  delete(guildId: bigint, commandId: bigint): Promise<void>
}

export interface OperatorPlacementRepository {
  placements(
    name: string,
  ): Promise<Array<{ guildId: bigint; commandId: bigint }>>
  record(name: string, guildId: bigint, commandId: bigint): Promise<void>
  forget(name: string, guildId: bigint): Promise<void>
}

export interface OperatorReconcileResult {
  guilds: number
  created: number
  updated: number
  removed: number
  failures: Array<{ name: string; guildId: bigint; error: unknown }>
}

/**
 * Operator commands never enter Sapphire's registries. They are placed in
 * the guilds the operator list names, through per-command REST, and removed
 * from guilds that leave the list. Placements persist so boots update
 * instead of recreating.
 */
export class OperatorCommands {
  public constructor(
    private readonly definitions: () => readonly OperatorCommandDefinition[],
    private readonly guilds: () => Promise<ReadonlySet<bigint>>,
    private readonly gateway: OperatorCommandGateway,
    private readonly placements: OperatorPlacementRepository,
  ) {}

  /** Names whose ids are owned here, not by Sapphire's registry persistence. */
  public names(): ReadonlySet<string> {
    return new Set(this.definitions().map((definition) => definition.name))
  }

  public async reconcile(
    signal: AbortSignal,
  ): Promise<OperatorReconcileResult> {
    const desired = await this.guilds()
    const result: OperatorReconcileResult = {
      guilds: desired.size,
      created: 0,
      updated: 0,
      removed: 0,
      failures: [],
    }
    for (const definition of this.definitions()) {
      signal.throwIfAborted()
      const existing = new Map(
        (await this.placements.placements(definition.name)).map((placement) => [
          placement.guildId,
          placement.commandId,
        ]),
      )
      for (const guildId of desired) {
        signal.throwIfAborted()
        try {
          const commandId = existing.get(guildId)
          if (
            commandId !== undefined &&
            (await this.gateway.update(guildId, commandId, definition.data))
          ) {
            result.updated++
            continue
          }
          const created = await this.gateway.create(guildId, definition.data)
          await this.placements.record(definition.name, guildId, created)
          result.created++
        } catch (error) {
          signal.throwIfAborted()
          result.failures.push({ name: definition.name, guildId, error })
        }
      }
      for (const [guildId, commandId] of existing) {
        if (desired.has(guildId)) continue
        signal.throwIfAborted()
        try {
          await this.gateway.delete(guildId, commandId)
          await this.placements.forget(definition.name, guildId)
          result.removed++
        } catch (error) {
          signal.throwIfAborted()
          result.failures.push({ name: definition.name, guildId, error })
        }
      }
    }
    return result
  }
}

/** Parse a comma-separated guild list; blanks and junk are ignored, never fatal. */
export function parseGuildList(raw: unknown): Set<bigint> {
  const ids = new Set<bigint>()
  if (typeof raw !== 'string') return ids
  for (const part of raw.split(',')) {
    const id = part.trim()
    if (/^\d+$/.test(id)) ids.add(BigInt(id))
  }
  return ids
}
