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

/**
 * Promoted guild tag commands: the machinery that turns a stored tag into a
 * real guild-scoped slash command (`/hello` instead of `/tag show hello`).
 * Registration is strictly per-command REST — Sapphire's own registry bulk
 * overwrites any guild it registers into (the dev guild), and a bulk PUT
 * from here would do the same to everyone else's promoted commands.
 */

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

/**
 * The command name a tag would get, or why it can't have one. Lowercasing
 * is the only silent adjustment (Discord requires it and citext tag names
 * are case-insensitive anyway); anything else fails validation rather than
 * being mangled. `reservedNames` should hold the bot's own chat input
 * command names — a guild command may not shadow those.
 */
export function tagCommandName(
  tagName: string,
  reservedNames: ReadonlySet<string>,
): TagCommandNameResult {
  const name = tagName.toLowerCase()
  if (!COMMAND_NAME_PATTERN.test(name)) return { ok: false, reason: 'invalid' }
  if (reservedNames.has(name)) return { ok: false, reason: 'reserved' }
  return { ok: true, name }
}

/** The bot's own chat input command names, all promotion-reserved. */
export function reservedCommandNames(): Set<string> {
  const names = new Set<string>()
  for (const command of container.stores.get('commands').values()) {
    names.add(command.name.toLowerCase())
  }
  return names
}

// Discord caps descriptions at 100 characters.
export const MAX_COMMAND_DESCRIPTION_LENGTH = 100

/**
 * The full command payload for a promoted tag. Every promoted command
 * carries one optional `args` string option, forwarded to the tagscript
 * renderer exactly like `/tag show`'s — promoted tags stay programmable.
 * The option description is intentionally a fixed string: reconciliation
 * recreates commands with no interaction (and thus no locale) at hand.
 */
export function guildTagCommandData(
  name: string,
  description: string,
): ApplicationCommandDataResolvable {
  return {
    name,
    description: description.slice(0, MAX_COMMAND_DESCRIPTION_LENGTH),
    options: [
      {
        type: ApplicationCommandOptionType.String,
        name: 'args',
        description: 'Space-separated arguments passed to the tag',
      },
    ],
  }
}

/**
 * Register the guild command for a tag and return the command id Discord
 * assigned. Throws on REST failure — callers run this inside the promotion
 * transaction so a failed registration rolls the database back.
 */
export async function createGuildTagCommand(
  client: Client<true>,
  guildId: string,
  name: string,
  description: string,
): Promise<bigint> {
  const command = await client.application.commands.create(
    guildTagCommandData(name, description),
    guildId,
  )
  return BigInt(command.id)
}

/**
 * Delete a promoted tag's guild command. An already-gone command is
 * success, not failure — demotion converges on "no command" either way.
 */
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

/** Whether a REST failure means the guild hit Discord's command cap. */
export function isCommandCapError(error: unknown): boolean {
  return (
    error instanceof DiscordAPIError &&
    error.code === RESTJSONErrorCodes.MaximumNumberOfApplicationCommandsReached
  )
}

/**
 * Which promoted rows a guild must demote to fit under `cap`: the newest
 * promotions go first, so long-standing commands survive an entitlement
 * lapse. Pure selection logic, shared by the reconcile task and its tests.
 */
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
