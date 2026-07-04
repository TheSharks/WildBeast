import { ApplyOptions } from '@sapphire/decorators'
import type { Command } from '@sapphire/framework'
import { applyLocalizedBuilder, resolveKey } from '@sapphire/plugin-i18next'
import type { Subcommand } from '@sapphire/plugin-subcommands'
import { MessageFlags, type SlashCommandStringOption } from 'discord.js'
import { TracedSubcommand } from '../../structures/subcommand.mjs'
import {
  BOORU_QUERY_MAX_LENGTH,
  type BooruSiteName,
  booruSites,
  buildBooruPage,
  channelAllowsNsfw,
  isBooruSiteName,
} from '../../utils/booru.mjs'

@ApplyOptions<Subcommand.Options>({
  cooldownDelay: 3_000,
  subcommands: [
    { name: 'e621', chatInputRun: 'chatInputE621' },
    { name: 'rule34', chatInputRun: 'chatInputRule34' },
    { name: 'derpibooru', chatInputRun: 'chatInputDerpibooru' },
  ],
})
export class BooruCommand extends TracedSubcommand {
  public override registerApplicationCommands(registry: Subcommand.Registry) {
    const queryOption = (option: SlashCommandStringOption) =>
      applyLocalizedBuilder(
        option,
        'commands/names:booruOptionQuery',
        'commands/descriptions:booruOptionQuery',
      )
        .setRequired(true)
        .setMaxLength(BOORU_QUERY_MAX_LENGTH)
        .setAutocomplete(true)

    registry.registerChatInputCommand((builder) => {
      applyLocalizedBuilder(
        builder,
        'commands/names:booru',
        'commands/descriptions:booru',
      )
        .addSubcommand((sub) =>
          applyLocalizedBuilder(
            sub,
            'commands/names:booruE621',
            'commands/descriptions:booruE621',
          ).addStringOption(queryOption),
        )
        .addSubcommand((sub) =>
          applyLocalizedBuilder(
            sub,
            'commands/names:booruRule34',
            'commands/descriptions:booruRule34',
          ).addStringOption(queryOption),
        )
        .addSubcommand((sub) =>
          applyLocalizedBuilder(
            sub,
            'commands/names:booruDerpibooru',
            'commands/descriptions:booruDerpibooru',
          ).addStringOption(queryOption),
        )
    })
  }

  public override async autocompleteRun(
    interaction: Command.AutocompleteInteraction,
  ) {
    const site = interaction.options.getSubcommand(false)
    if (!site || !isBooruSiteName(site)) {
      return interaction.respond([])
    }

    // Complete the word being typed and keep the already-entered tags in
    // front, so multi-tag queries stay autocompletable.
    const chunks = interaction.options.getFocused().split(' ')
    const term = chunks.pop() ?? ''
    if (term.length === 0) {
      return interaction.respond([])
    }

    const hits = await booruSites[site]
      .autocomplete(term, channelAllowsNsfw(interaction))
      .catch(() => [])
    return interaction.respond(
      hits
        .map((hit) => [...chunks, hit].join(' ').trim())
        .filter(
          (value) => value.length > 0 && value.length <= BOORU_QUERY_MAX_LENGTH,
        )
        .slice(0, 25)
        .map((value) => ({ name: value, value })),
    )
  }

  public chatInputE621(interaction: Subcommand.ChatInputCommandInteraction) {
    return this.runSite(interaction, 'e621')
  }

  public chatInputRule34(interaction: Subcommand.ChatInputCommandInteraction) {
    return this.runSite(interaction, 'rule34')
  }

  public chatInputDerpibooru(
    interaction: Subcommand.ChatInputCommandInteraction,
  ) {
    return this.runSite(interaction, 'derpibooru')
  }

  private async runSite(
    interaction: Subcommand.ChatInputCommandInteraction,
    site: BooruSiteName,
  ) {
    const nsfwAllowed = channelAllowsNsfw(interaction)
    if (booruSites[site].gated && !nsfwAllowed) {
      return interaction.reply({
        content: (await resolveKey(
          interaction,
          'commands/common:nsfwDisabled',
        )) as string,
        flags: MessageFlags.Ephemeral,
      })
    }

    const query = interaction.options.getString('query', true)
    await interaction.deferReply()

    const posts = await booruSites[site].search(query, nsfwAllowed)
    if (posts.length === 0) {
      return interaction.editReply(
        (await resolveKey(interaction, 'commands/common:noResultsFor', {
          query,
        })) as string,
      )
    }

    return interaction.editReply(
      await buildBooruPage(interaction, site, query, posts, 0),
    )
  }
}
