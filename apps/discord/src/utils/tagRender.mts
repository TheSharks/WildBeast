import { resolveKey } from '@sapphire/plugin-i18next'
import { RenderError, render } from '@thesharks/tagscript'
import type { ChatInputCommandInteraction } from 'discord.js'
import { MessageFlags } from 'discord.js'

export type TagRenderOutcome = 'success' | 'renderError' | 'emptyOutput'

// Render tag content for `/tag show` and promoted commands alike (shared `args` option).
export async function replyWithRenderedTag(
  interaction: ChatInputCommandInteraction,
  content: string,
): Promise<TagRenderOutcome> {
  let output: string
  try {
    const result = await render(content, {
      maxOutputLength: 2000,
      args:
        interaction.options.getString('args')?.split(/\s+/).filter(Boolean) ??
        [],
      discord: {
        user: {
          id: interaction.user.id,
          tag: interaction.user.tag,
          mention: interaction.user.toString(),
          avatarUrl: interaction.user.displayAvatarURL(),
        },
        channelId: interaction.channelId,
        serverId: interaction.guildId ?? undefined,
        server: interaction.guild?.name,
      },
    })
    output = result.output.trim()
  } catch (error) {
    if (error instanceof RenderError) {
      await interaction.reply({
        content: (await resolveKey(interaction, 'commands/tag:renderFailed', {
          error: error.message,
        })) as string,
        flags: MessageFlags.Ephemeral,
        allowedMentions: { parse: [] },
      })
      return 'renderError'
    }
    throw error
  }

  if (!output) {
    await interaction.reply({
      content: (await resolveKey(
        interaction,
        'commands/tag:emptyOutput',
      )) as string,
      flags: MessageFlags.Ephemeral,
      allowedMentions: { parse: [] },
    })
    return 'emptyOutput'
  }

  await interaction.reply({
    content: output,
    // User-authored content; never ping.
    allowedMentions: { parse: [] },
  })
  return 'success'
}
