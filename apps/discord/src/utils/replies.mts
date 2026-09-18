import { resolveKey, type Target } from '@sapphire/plugin-i18next'
import {
  type CommandInteraction,
  type MessageComponentInteraction,
  MessageFlags,
  TextDisplayBuilder,
} from 'discord.js'

/** A localized string. `resolveKey` is typed for object lookups; these keys are plain text. */
export async function text(
  target: Target,
  key: string,
  values?: Record<string, unknown>,
): Promise<string> {
  return (await (values
    ? resolveKey(target, key, values)
    : resolveKey(target, key))) as string
}

/** Tell the user the feature is off or the worker is stopping, unless they already got an answer. */
export async function replyFeatureUnavailable(
  interaction: CommandInteraction | MessageComponentInteraction,
): Promise<void> {
  if (interaction.replied || interaction.deferred) return
  await interaction.reply({
    content: await text(interaction, 'system/errors:feature_unavailable'),
    flags: MessageFlags.Ephemeral,
  })
}

/** Replace a component message whose update was deferred with a "try again" notice. */
export async function editReplyTryAgain(
  interaction: MessageComponentInteraction,
) {
  // Localization can be what failed; never let the fallback throw as well.
  const content = await text(interaction, 'system/errors:try_again').catch(
    () => 'Something went wrong. Try again later.',
  )
  return interaction.editReply({
    // The V2 flag is sticky, so the notice must stay a component.
    components: [new TextDisplayBuilder().setContent(content)],
    flags: MessageFlags.IsComponentsV2,
    allowedMentions: { parse: [] },
  })
}
