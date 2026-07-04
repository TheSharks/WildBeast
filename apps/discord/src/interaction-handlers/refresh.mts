import { ApplyOptions } from '@sapphire/decorators'
import {
  InteractionHandler,
  InteractionHandlerTypes,
} from '@sapphire/framework'
import type { ButtonInteraction } from 'discord.js'
import {
  type RefreshableKind,
  refreshableBuilders,
} from '../utils/funMessages.mjs'

/**
 * The 🔄 button under cat/dog/inspire messages: rebuild the same message
 * with a fresh image. Stateless, so the buttons keep working forever.
 */
@ApplyOptions<InteractionHandler.Options>({
  interactionHandlerType: InteractionHandlerTypes.Button,
})
export class RefreshButtonHandler extends InteractionHandler {
  public override parse(interaction: ButtonInteraction) {
    const [prefix, kind] = interaction.customId.split(':')
    if (prefix !== 'refresh' || !(kind in refreshableBuilders)) {
      return this.none()
    }
    return this.some(kind as RefreshableKind)
  }

  public async run(interaction: ButtonInteraction, kind: RefreshableKind) {
    await interaction.deferUpdate()
    await interaction.editReply(await refreshableBuilders[kind](interaction))
  }
}
