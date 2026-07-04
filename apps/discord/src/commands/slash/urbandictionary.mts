import { ApplyOptions } from '@sapphire/decorators'
import type { Command } from '@sapphire/framework'
import { applyLocalizedBuilder, resolveKey } from '@sapphire/plugin-i18next'
import { MessageFlags } from 'discord.js'
import { TracedCommand } from '../../structures/command.mjs'
import {
  buildUrbanPage,
  fetchCompletions,
  fetchDefinitions,
  URBAN_QUERY_MAX_LENGTH,
} from '../../utils/urban.mjs'

@ApplyOptions<Command.Options>({
  cooldownDelay: 3_000,
})
export class UrbanDictionaryCommand extends TracedCommand {
  public override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand(
      (builder) => {
        applyLocalizedBuilder(
          builder,
          'commands/names:urbandictionary',
          'commands/descriptions:urbandictionary',
        ).addStringOption((option) =>
          applyLocalizedBuilder(
            option,
            'commands/names:urbanOptionQuery',
            'commands/descriptions:urbanOptionQuery',
          )
            .setRequired(true)
            .setMaxLength(URBAN_QUERY_MAX_LENGTH)
            .setAutocomplete(true),
        )
      },
      {
        guildIds: ['1034462346908794910'],
      },
    )
  }

  public override async autocompleteRun(
    interaction: Command.AutocompleteInteraction,
  ) {
    const focused = interaction.options.getFocused()
    if (focused.length === 0) {
      return interaction.respond([])
    }
    const hits = await fetchCompletions(focused).catch(() => [])
    return interaction.respond(
      hits
        .filter((hit) => hit.length > 0 && hit.length <= URBAN_QUERY_MAX_LENGTH)
        .slice(0, 25)
        .map((hit) => ({ name: hit, value: hit })),
    )
  }

  public async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
    const query = interaction.options.getString('query', true)
    await interaction.deferReply()

    const definitions = await fetchDefinitions(query)
    if (definitions.length === 0) {
      return interaction.editReply(
        (await resolveKey(
          interaction,
          'commands/urbandictionary:notFound',
        )) as string,
      )
    }

    return interaction.editReply(
      await buildUrbanPage(interaction, query, definitions, 0),
    )
  }
}
