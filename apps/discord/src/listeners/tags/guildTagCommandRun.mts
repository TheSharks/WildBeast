import { ApplyOptions } from '@sapphire/decorators'
import type {
  ListenerOptions,
  UnknownChatInputCommandPayload,
} from '@sapphire/framework'
import { Events, Listener } from '@sapphire/framework'
import { resolveKey } from '@sapphire/plugin-i18next'
import { MessageFlags } from 'discord.js'
import { booleanFlagValue } from '../../features/client.mjs'
import { commandFlagContext } from '../../features/commandContext.mjs'
import { executionsCounter } from '../../utils/guildTagCommands.mjs'
import { replyWithRenderedTag } from '../../utils/tagRender.mjs'
import { TagCommands } from '../../utils/tagService.mjs'

// Promoted tags arrive as unknown commands; match by id, collision-proof against names/case.
@ApplyOptions<ListenerOptions>({
  event: Events.UnknownChatInputCommand,
})
export class GuildTagCommandRunListener extends Listener {
  public async run(payload: UnknownChatInputCommandPayload) {
    const { interaction } = payload
    if (!interaction.guildId) return

    // Promoted commands outlive /tag invocations, so they need their own kill switch.
    const enabled = await booleanFlagValue(
      'features.tags.guildCommands',
      commandFlagContext(interaction, interaction.commandName),
    )
    if (!enabled) {
      return interaction.reply({
        content: (await resolveKey(
          interaction,
          'system/errors:feature_unavailable',
        )) as string,
        flags: MessageFlags.Ephemeral,
      })
    }

    // Thin delegate; guild scope plus one in-flight re-read live in the service.
    const result = await TagCommands.resolve({
      commandId: interaction.commandId,
      guildId: interaction.guildId,
    })
    if (result.kind === 'miss') {
      executionsCounter.add(1, { outcome: 'orphaned' })
      await interaction.reply({
        content: (await resolveKey(
          interaction,
          'commands/tag:promotedCommandGone',
        )) as string,
        flags: MessageFlags.Ephemeral,
      })
      // Best effort; reconciliation mops up misses.
      try {
        await TagCommands.deleteCommand(
          interaction.client,
          interaction.guildId,
          BigInt(interaction.commandId),
          'orphanCleanup',
        )
      } catch (error) {
        this.container.logger.warn(
          `Could not delete orphaned guild command ${interaction.commandId}`,
          error,
        )
      }
      return
    }

    const outcome = await replyWithRenderedTag(interaction, result.tag.content)
    executionsCounter.add(1, { outcome })
  }
}
