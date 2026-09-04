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
  buildUrbanPage,
  fetchDefinitions,
  URBAN_CUSTOM_ID_PREFIX,
} from '../utils/urban.mjs'

interface UrbanPageAction {
  query: string
  position: number | 'random'
}

/** Stateless /urbandictionary pagination; custom id carries query+page for refetch. */
@ApplyOptions<GatedCommandInteractionHandlerOptions>({
  interactionHandlerType: InteractionHandlerTypes.Button,
  command: 'urbandictionary',
})
export class UrbanPagesHandler extends GatedCommandInteractionHandler {
  public override parse(interaction: ButtonInteraction) {
    if (!interaction.customId.startsWith(URBAN_CUSTOM_ID_PREFIX)) {
      return this.none()
    }
    const rest = interaction.customId.slice(URBAN_CUSTOM_ID_PREFIX.length)
    const separator = rest.indexOf(':')
    if (separator === -1) return this.none()

    const target = rest.slice(0, separator)
    const query = rest.slice(separator + 1)
    return this.some<UrbanPageAction>({
      query,
      position: target === 'rnd' ? 'random' : Number(target),
    })
  }

  public async run(interaction: ButtonInteraction, action: UrbanPageAction) {
    await interaction.deferUpdate()

    try {
      const definitions = await fetchDefinitions(action.query)
      if (definitions.length === 0) {
        // V2 flag is sticky; fallback must stay a component.
        return interaction.editReply({
          components: [
            new TextDisplayBuilder().setContent(
              (await resolveKey(
                interaction,
                'commands/urbandictionary:notFound',
                { query: action.query.replace(/`/g, '\\`') },
              )) as string,
            ),
          ],
          flags: MessageFlags.IsComponentsV2,
          allowedMentions: { parse: [] },
        })
      }

      const position =
        action.position === 'random'
          ? Math.floor(Math.random() * definitions.length)
          : Number.isInteger(action.position)
            ? action.position
            : 0

      return interaction.editReply(
        await buildUrbanPage(interaction, action.query, definitions, position),
      )
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
      return interaction.editReply({
        components: [new TextDisplayBuilder().setContent(content)],
        flags: MessageFlags.IsComponentsV2,
        allowedMentions: { parse: [] },
      })
    }
  }
}
