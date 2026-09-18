import { ApplyOptions } from '@sapphire/decorators'
import { InteractionHandlerTypes } from '@sapphire/framework'
import type { ButtonInteraction } from 'discord.js'
import {
  type RefreshableKind,
  refreshableBuilders,
} from '../integrations/fun-messages.mjs'
import {
  GatedCommandInteractionHandler,
  type GatedCommandInteractionHandlerOptions,
} from '../structures/interactionHandler.mjs'
import { editReplyTryAgain } from '../utils/replies.mjs'

/** Stateless 🔄 rebuild for cat/dog/inspire messages. */
@ApplyOptions<GatedCommandInteractionHandlerOptions>({
  interactionHandlerType: InteractionHandlerTypes.Button,
  command: (kind) => kind as RefreshableKind,
})
export class RefreshButtonHandler extends GatedCommandInteractionHandler {
  public override parse(interaction: ButtonInteraction) {
    const [prefix, kind] = interaction.customId.split(':')
    if (prefix !== 'refresh' || !(kind in refreshableBuilders)) {
      return this.none()
    }
    return this.some(kind as RefreshableKind)
  }

  public async run(interaction: ButtonInteraction, kind: RefreshableKind) {
    await interaction.deferUpdate()

    try {
      await interaction.editReply(await refreshableBuilders[kind](interaction))
    } catch {
      await editReplyTryAgain(interaction)
    }
  }
}
