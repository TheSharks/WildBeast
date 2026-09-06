import { ApplyOptions } from '@sapphire/decorators'
import type { Command } from '@sapphire/framework'
import { applyLocalizedBuilder, resolveKey } from '@sapphire/plugin-i18next'
import type { Subcommand } from '@sapphire/plugin-subcommands'
import { MessageFlags } from 'discord.js'
import {
  formatFlagDetail,
  formatFlagList,
  inspectAllFlags,
  inspectableKeys,
  inspectFlag,
} from '../features/inspect.mjs'
import { subjectFromInteraction } from '../premium/interaction.mjs'
import {
  AppSubcommand,
  type AppSubcommandOptions,
} from '../structures/command.mjs'

/** Live flag inspector; placed only in operator guilds and run only by owners. */
@ApplyOptions<AppSubcommandOptions>({
  scope: 'operator',
  subcommands: [
    { name: 'list', chatInputRun: 'chatInputList' },
    { name: 'inspect', chatInputRun: 'chatInputInspect' },
  ],
})
export class FlagsCommand extends AppSubcommand {
  public override registerApplicationCommands(registry: Subcommand.Registry) {
    registry.registerChatInputCommand((builder) => {
      applyLocalizedBuilder(
        builder,
        'commands/names:flags',
        'commands/descriptions:flags',
      )
        .addSubcommand((sub) =>
          applyLocalizedBuilder(
            sub,
            'commands/names:flagsList',
            'commands/descriptions:flagsList',
          ).addStringOption((option) =>
            applyLocalizedBuilder(
              option,
              'commands/names:flagsOptionKind',
              'commands/descriptions:flagsOptionKind',
            ).setChoices(
              { name: 'gate', value: 'gate' },
              { name: 'experiment', value: 'experiment' },
              { name: 'setting', value: 'setting' },
              { name: 'limit', value: 'limit' },
            ),
          ),
        )
        .addSubcommand((sub) =>
          applyLocalizedBuilder(
            sub,
            'commands/names:flagsInspect',
            'commands/descriptions:flagsInspect',
          ).addStringOption((option) =>
            applyLocalizedBuilder(
              option,
              'commands/names:flagsOptionKey',
              'commands/descriptions:flagsOptionKey',
            )
              .setRequired(true)
              .setAutocomplete(true),
          ),
        )
    })
  }

  public override async autocompleteRun(
    interaction: Command.AutocompleteInteraction,
  ) {
    const focused = interaction.options.getFocused().toLowerCase()
    const keys = inspectableKeys()
      .filter((key) => key.toLowerCase().includes(focused))
      .slice(0, 25)
    return interaction.respond(keys.map((key) => ({ name: key, value: key })))
  }

  private context(interaction: Subcommand.ChatInputCommandInteraction) {
    return this.container.app.gates.flagContext(
      subjectFromInteraction(interaction),
      {
        command: this.name,
        subcommand: interaction.options.getSubcommand(false) ?? undefined,
      },
    )
  }

  public async chatInputList(
    interaction: Subcommand.ChatInputCommandInteraction,
  ) {
    // Flag fan-out is slow; defer up front.
    await interaction.deferReply({ flags: MessageFlags.Ephemeral })
    const kind = interaction.options.getString('kind')
    const inspections = (
      await inspectAllFlags(this.container.app.flags, this.context(interaction))
    ).filter((inspection) => !kind || inspection.kind === kind)
    const chunks = formatFlagList(inspections)
    if (chunks.length === 0) {
      return interaction.editReply(
        (await resolveKey(interaction, 'commands/flags:listEmpty')) as string,
      )
    }
    await interaction.editReply(chunks[0] as string)
    for (const chunk of chunks.slice(1)) {
      await interaction.followUp({
        content: chunk,
        flags: MessageFlags.Ephemeral,
      })
    }
    return undefined
  }

  public async chatInputInspect(
    interaction: Subcommand.ChatInputCommandInteraction,
  ) {
    const key = interaction.options.getString('key', true)
    const inspection = await inspectFlag(
      this.container.app.flags,
      key,
      this.context(interaction),
    )
    if (!inspection) {
      return interaction.reply({
        content: (await resolveKey(interaction, 'commands/flags:unknownKey', {
          key,
        })) as string,
        flags: MessageFlags.Ephemeral,
        allowedMentions: { parse: [] },
      })
    }
    return interaction.reply({
      content: formatFlagDetail(inspection),
      flags: MessageFlags.Ephemeral,
    })
  }
}
