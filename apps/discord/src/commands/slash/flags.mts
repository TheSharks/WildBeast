import { ApplyOptions } from '@sapphire/decorators'
import type { Command } from '@sapphire/framework'
import { applyLocalizedBuilder, resolveKey } from '@sapphire/plugin-i18next'
import type { Subcommand } from '@sapphire/plugin-subcommands'
import { MessageFlags } from 'discord.js'
import { commandFlagContext } from '../../features/commandContext.mjs'
import {
  formatFlagDetail,
  formatFlagList,
  inspectAllFlags,
  inspectableKeys,
  inspectFlag,
} from '../../features/inspect.mjs'
import { TracedSubcommand } from '../../structures/subcommand.mjs'

/**
 * Owner-only visibility into the runtime flag surface: every registered
 * gate, experiment and limit flag with its live value, evaluation source
 * and expiry. Registered globally — registering it into a support guild
 * would let Sapphire's bulk overwrite wipe that guild's promoted tag
 * commands — and hidden from members via default permissions '0'; the
 * OwnerOnly precondition does the real gating.
 */
@ApplyOptions<Subcommand.Options>({
  preconditions: ['OwnerOnly'],
  subcommands: [
    { name: 'list', chatInputRun: 'chatInputList' },
    { name: 'inspect', chatInputRun: 'chatInputInspect' },
  ],
})
export class FlagsCommand extends TracedSubcommand {
  public override registerApplicationCommands(registry: Subcommand.Registry) {
    registry.registerChatInputCommand((builder) => {
      applyLocalizedBuilder(
        builder,
        'commands/names:flags',
        'commands/descriptions:flags',
      )
        .setDefaultMemberPermissions('0')
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

  public async chatInputList(
    interaction: Subcommand.ChatInputCommandInteraction,
  ) {
    // Evaluations can stack up (one per flag); buy time up front.
    await interaction.deferReply({ flags: MessageFlags.Ephemeral })

    const kind = interaction.options.getString('kind')
    const inspections = (
      await inspectAllFlags(commandFlagContext(interaction, this.name))
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
      key,
      commandFlagContext(interaction, this.name),
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
