import { container } from '@sapphire/framework'
import { metrics } from '@thesharks/analytics'
import type { Tag } from '@thesharks/drizzle'
import {
  type ApplicationCommandDataResolvable,
  ApplicationCommandOptionType,
  type Client,
  DiscordAPIError,
  RESTJSONErrorCodes,
} from 'discord.js'

// Promoted tags as real guild slash commands; strictly per-command REST (never bulk PUT).

const meter = metrics.getMeter('@thesharks/discord')
export const promotionsCounter = meter.createCounter(
  'discord_guild_tag_command_promotions_total',
  {
    description: 'Guild tag command promotions and demotions',
  },
)
export const executionsCounter = meter.createCounter(
  'discord_guild_tag_command_executions_total',
  {
    description: 'Promoted guild tag command invocations',
  },
)

/** Discord's application command name shape (lowercase enforced separately). */
const COMMAND_NAME_PATTERN = /^[-_\p{L}\p{N}\p{sc=Deva}\p{sc=Thai}]{1,32}$/u

export type TagCommandNameResult =
  | { ok: true; name: string }
  | { ok: false; reason: 'invalid' | 'reserved' }

// Command name for a tag, or why it can't have one; only lowercasing is silent.
export function tagCommandName(
  tagName: string,
  reservedNames: ReadonlySet<string>,
): TagCommandNameResult {
  const name = tagName.toLowerCase()
  if (!COMMAND_NAME_PATTERN.test(name)) return { ok: false, reason: 'invalid' }
  if (reservedNames.has(name)) return { ok: false, reason: 'reserved' }
  return { ok: true, name }
}

// Bot command names; promotions may not shadow them.
export function reservedCommandNames(): Set<string> {
  const names = new Set<string>()
  for (const command of container.stores.get('commands').values()) {
    names.add(command.name.toLowerCase())
  }
  return names
}

// Discord description cap.
export const MAX_COMMAND_DESCRIPTION_LENGTH = 100

// Promoted-tag payload with one optional `args` option; caller supplies the localized description.
export function guildTagCommandData(
  name: string,
  description: string,
  argsDescription: string,
): ApplicationCommandDataResolvable {
  return {
    name,
    description: description.slice(0, MAX_COMMAND_DESCRIPTION_LENGTH),
    options: [
      {
        type: ApplicationCommandOptionType.String,
        name: 'args',
        description: argsDescription.slice(0, MAX_COMMAND_DESCRIPTION_LENGTH),
      },
    ],
  }
}

// Whether a guild command has our tag shape; only those are safe for orphan cleanup.
export function isTagCommandShape(command: { options?: unknown }): boolean {
  if (!Array.isArray(command.options) || command.options.length !== 1) {
    return false
  }
  const [option] = command.options as Array<{
    name?: unknown
    type?: unknown
    required?: unknown
  }>
  return (
    option?.name === 'args' &&
    option?.type === ApplicationCommandOptionType.String &&
    option?.required !== true
  )
}

// Register the guild command; throws so the promotion transaction rolls back.
export async function createGuildTagCommand(
  client: Client<true>,
  guildId: string,
  name: string,
  description: string,
  argsDescription: string,
): Promise<bigint> {
  const command = await client.application.commands.create(
    guildTagCommandData(name, description, argsDescription),
    guildId,
  )
  return BigInt(command.id)
}

// Delete a promoted command; already-gone counts as success.
export async function deleteGuildTagCommand(
  client: Client<true>,
  guildId: string,
  commandId: bigint,
): Promise<void> {
  try {
    await client.application.commands.delete(commandId.toString(), guildId)
  } catch (error) {
    if (
      error instanceof DiscordAPIError &&
      error.code === RESTJSONErrorCodes.UnknownApplicationCommand
    ) {
      return
    }
    throw error
  }
}

// Whether the error is Discord's guild command cap.
export function isCommandCapError(error: unknown): boolean {
  return (
    error instanceof DiscordAPIError &&
    error.code === RESTJSONErrorCodes.MaximumNumberOfApplicationCommandsReached
  )
}

// Rows to demote over `cap`, newest first; null promotedAt counts as oldest.
export function promotionsOverCap<Row extends Pick<Tag, 'promotedAt'>>(
  rows: readonly Row[],
  cap: number,
): Row[] {
  if (!Number.isFinite(cap)) return []
  return [...rows]
    .sort(
      (a, b) => (a.promotedAt?.getTime() ?? 0) - (b.promotedAt?.getTime() ?? 0),
    )
    .slice(Math.max(0, cap))
}
