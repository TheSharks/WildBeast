import { Precondition } from '@sapphire/framework'
import type {
  ChatInputCommandInteraction,
  ContextMenuCommandInteraction,
} from 'discord.js'

export const OwnerOnlyPreconditionIdentifier = 'preconditionOwnerOnly'

/** Unset owner ids deny everyone: an operator surface never fails open. */
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
    if (this.container.app.config.ownerIds.has(BigInt(interaction.user.id)))
      return this.ok()
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
