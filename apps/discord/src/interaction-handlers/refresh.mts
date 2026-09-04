import { ApplyOptions } from '@sapphire/decorators'
import { InteractionHandlerTypes } from '@sapphire/framework'
import { resolveKey } from '@sapphire/plugin-i18next'
import {
  type ButtonInteraction,
  MessageFlags,
  TextDisplayBuilder,
} from 'discord.js'
import {
  GatedCommandInteractionHandler,
  type GatedCommandInteractionHandlerOptions,
} from '../structures/interactionHandler.mjs'
import {
  type RefreshableKind,
  refreshableBuilders,
} from '../utils/funMessages.mjs'

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
      let content: string
      try {
        content = (await resolveKey(
          interaction,
          'system/errors:try_again',
        )) as string
      } catch {
        content = 'Something went wrong. Try again later.'
      }
      await interaction.editReply({
        components: [new TextDisplayBuilder().setContent(content)],
        flags: MessageFlags.IsComponentsV2,
        allowedMentions: { parse: [] },
      })
    }
  }
}
