import { container } from '@sapphire/framework'
import { resolveKey } from '@sapphire/plugin-i18next'
import {
  Colors,
  type CommandInteraction,
  ContainerBuilder,
  MessageFlags,
  SeparatorBuilder,
  TextDisplayBuilder,
} from 'discord.js'

/** User-facing failure report; user sees generic message + uuid, full error logged for correlation. */
export async function sendErrorReport(
  interaction: CommandInteraction,
  error: unknown,
  uuid: string,
): Promise<void> {
  try {
    container.logger.error(`Command failed [${uuid}]:`, error)
  } catch {
    // Never break user reply on logging failure.
  }

  const containerBuilder = new ContainerBuilder()
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

  // Deferred counts as replied; V2 flag + clears must ride the edit.
  if (interaction.replied || interaction.deferred) {
    await interaction.editReply({
      content: null,
      embeds: [],
      components: [containerBuilder],
      flags: MessageFlags.IsComponentsV2,
    })
  } else {
    await interaction.reply({
      components: [containerBuilder],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    })
  }
}
