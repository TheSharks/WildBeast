import { resolveKey } from '@sapphire/plugin-i18next'
import {
  Colors,
  type CommandInteraction,
  ContainerBuilder,
  MessageFlags,
  SeparatorBuilder,
  TextDisplayBuilder,
} from 'discord.js'

/** Generic failure report with a correlation id; the full error stays in logs. */
export async function sendErrorReport(
  interaction: CommandInteraction,
  uuid: string,
): Promise<void> {
  const report = new ContainerBuilder()
    .setAccentColor(Colors.Red)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `## ${await resolveKey(interaction, 'system/errors:oops')}`,
      ),
      new TextDisplayBuilder().setContent(
        await resolveKey(interaction, 'system/errors:try_again'),
      ),
    )
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          `**${await resolveKey(interaction, 'system/errors:error_code')}:** \`${uuid}\``,
          `-# ${await resolveKey(interaction, 'system/errors:report')}`,
        ].join('\n'),
      ),
    )
  if (interaction.replied || interaction.deferred) {
    await interaction.editReply({
      content: null,
      embeds: [],
      components: [report],
      flags: MessageFlags.IsComponentsV2,
    })
  } else {
    await interaction.reply({
      components: [report],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    })
  }
}
