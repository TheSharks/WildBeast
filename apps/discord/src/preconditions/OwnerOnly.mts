import { Precondition } from '@sapphire/framework'
import type {
  ChatInputCommandInteraction,
  ContextMenuCommandInteraction,
} from 'discord.js'

/** Identifier carried by denial errors; commandDeniedReply.mts branches on
 * it for the localized message. */
export const OwnerOnlyPreconditionIdentifier = 'preconditionOwnerOnly'

/** The configured owner ids. Parsed per call: this only runs on owner
 * command invocations, which are rare by definition. */
export function ownerIds(
  env: NodeJS.ProcessEnv = process.env,
): ReadonlySet<string> {
  const raw = env.WILDBEAST_OWNER_IDS
  if (!raw) return new Set()
  return new Set(
    raw
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean),
  )
}

/**
 * Restrict a command to the bot's operators (WILDBEAST_OWNER_IDS). Unset
 * means deny everyone — an operator surface must never fail open. Commands
 * using this should also register with `setDefaultMemberPermissions('0')`
 * so guilds only show them to administrators in the first place.
 */
export class OwnerOnlyPrecondition extends Precondition {
  public override chatInputRun(interaction: ChatInputCommandInteraction) {
    return this.check(interaction)
  }

  public override contextMenuRun(interaction: ContextMenuCommandInteraction) {
    return this.check(interaction)
  }

  private check(
    interaction: ChatInputCommandInteraction | ContextMenuCommandInteraction,
  ) {
    if (ownerIds().has(interaction.user.id)) {
      return this.ok()
    }
    return this.error({
      identifier: OwnerOnlyPreconditionIdentifier,
      message: 'This command is reserved for the bot owner.',
    })
  }
}

declare module '@sapphire/framework' {
  interface Preconditions {
    OwnerOnly: never
  }
}
