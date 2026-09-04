import { ApplyOptions } from '@sapphire/decorators'
import type {
  ListenerOptions,
  UnknownChatInputCommandPayload,
} from '@sapphire/framework'
import { Events, Listener } from '@sapphire/framework'
import { resolveKey } from '@sapphire/plugin-i18next'
import { db, eq, tags } from '@thesharks/drizzle'
import { MessageFlags } from 'discord.js'
import { booleanFlagValue } from '../../features/client.mjs'
import { commandFlagContext } from '../../features/commandContext.mjs'
import {
  deleteGuildTagCommand,
  executionsCounter,
  promotionsCounter,
} from '../../utils/guildTagCommands.mjs'
import { replyWithRenderedTag } from '../../utils/tagRender.mjs'

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

    const tag = await db.query.tags.findFirst({
      where: eq(tags.commandId, BigInt(interaction.commandId)),
    })
    // CHECK: never render a tag outside its own guild.
    if (!tag || tag.guildId !== BigInt(interaction.guildId)) {
      // In-flight promotes register before the DB flips; re-read once before orphan handling.
      try {
        const reread = await db.query.tags.findFirst({
          where: eq(tags.commandId, BigInt(interaction.commandId)),
        })
        if (reread && reread.guildId === BigInt(interaction.guildId)) {
          const outcome = await replyWithRenderedTag(
            interaction,
            reread.content,
          )
          executionsCounter.add(1, { outcome })
          return
        }
      } catch {
        // Fall through to orphan handling on re-read failure.
      }
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
        await deleteGuildTagCommand(
          interaction.client,
          interaction.guildId,
          BigInt(interaction.commandId),
        )
        promotionsCounter.add(1, { action: 'demote', trigger: 'orphanCleanup' })
      } catch (error) {
        this.container.logger.warn(
          `Could not delete orphaned guild command ${interaction.commandId}`,
          error,
        )
      }
      return
    }

    const outcome = await replyWithRenderedTag(interaction, tag.content)
    executionsCounter.add(1, { outcome })
  }
}
