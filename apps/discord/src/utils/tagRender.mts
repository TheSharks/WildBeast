import { resolveKey } from '@sapphire/plugin-i18next'
import { RenderError, render } from '@thesharks/tagscript'
import type { ChatInputCommandInteraction } from 'discord.js'
import { MessageFlags } from 'discord.js'

export type TagRenderOutcome = 'success' | 'renderError' | 'emptyOutput'

/**
 * Render tag content and reply with the result — the one code path behind
 * both `/tag show` and promoted guild tag commands, so a tag behaves
 * identically however it's invoked. Reads the interaction's optional `args`
 * string option (both surfaces declare it with the same name) and splits it
 * exactly like `/tag show` always has.
 */
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
    })
    return 'emptyOutput'
  }

  await interaction.reply({
    content: output,
    // Tag content is user-authored: never let it ping anyone.
    allowedMentions: { parse: [] },
  })
  return 'success'
}
