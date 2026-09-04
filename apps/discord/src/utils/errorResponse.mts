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

/**
 * Send the user-facing report for a failed command as a Components V2
 * container. Handles both fresh and already acknowledged interactions.
 *
 * The user sees only a generic message plus the error code (uuid). The full
 * error is logged server-side so support can correlate via the uuid.
 */
export async function sendErrorReport(
  interaction: CommandInteraction,
  error: unknown,
  uuid: string,
): Promise<void> {
  try {
    container.logger.error(`Command failed [${uuid}]:`, error)
  } catch {
    // Logging must never break the user-facing reply.
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

  // A deferred interaction is acknowledged too; reply() would throw. The
  // IsComponentsV2 flag must be set on the edit as well, and any previous
  // content and embeds must be cleared in the same call.
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
