import { ApplyOptions } from '@sapphire/decorators'
import {
  InteractionHandler,
  InteractionHandlerTypes,
} from '@sapphire/framework'
import { resolveKey } from '@sapphire/plugin-i18next'
import { type ButtonInteraction, TextDisplayBuilder } from 'discord.js'
import {
  buildUrbanPage,
  fetchDefinitions,
  URBAN_CUSTOM_ID_PREFIX,
} from '../utils/urban.mjs'

interface UrbanPageAction {
  query: string
  position: number | 'random'
}

/**
 * Pagination for /urbandictionary. The custom id carries the query and
 * target page (`urban:<page>:<query>`), so paging refetches instead of
 * holding state and works across restarts.
 */
@ApplyOptions<InteractionHandler.Options>({
  interactionHandlerType: InteractionHandlerTypes.Button,
})
export class UrbanPagesHandler extends InteractionHandler {
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

    const definitions = await fetchDefinitions(action.query)
    if (definitions.length === 0) {
      // The message carries IsComponentsV2, which can't be unset, so the
      // fallback must stay a component rather than plain content.
      return interaction.editReply({
        components: [
          new TextDisplayBuilder().setContent(
            (await resolveKey(
              interaction,
              'commands/urbandictionary:notFound',
            )) as string,
          ),
        ],
      })
    }

    const position =
      action.position === 'random'
        ? Math.floor(Math.random() * definitions.length)
        : action.position

    return interaction.editReply(
      await buildUrbanPage(interaction, action.query, definitions, position),
    )
  }
}
