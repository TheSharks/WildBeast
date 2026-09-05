import { setTimeout as sleep } from 'node:timers/promises'
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
import {
  executionsCounter,
  isTagCommandShape,
} from '../../utils/guildTagCommands.mjs'
import { replyWithRenderedTag } from '../../utils/tagRender.mjs'
import { TagCommands } from '../../utils/tagService.mjs'

// Delay before orphan delete so a REST-create that precedes its DB commit isn't mistaken for garbage.
export const ORPHAN_RECHECK_DELAY_MS = 1_500

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
        // Never delete non-tag commands; rolling deploys can surface unknown ids for other features.
        let tagShaped = false
        try {
          const command = await interaction.client.application.commands.fetch(
            interaction.commandId,
            { guildId: interaction.guildId },
          )
          tagShaped = isTagCommandShape(command)
        } catch {
          // Fetch failed (already gone or API blip); skip, reconcile handles confirmed orphans.
          return
        }
        if (!tagShaped) return
        // Create-to-commit window: REST create can precede the DB flip, so delay + re-check before delete.
        await sleep(ORPHAN_RECHECK_DELAY_MS)
        const reread = await TagCommands.resolve({
          commandId: interaction.commandId,
          guildId: interaction.guildId,
        })
        if (reread.kind === 'hit') return
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
