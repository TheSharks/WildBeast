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

/**
 * Execute promoted guild tag commands. Sapphire has no piece for them —
 * they're registered per guild at promotion time — so they arrive as
 * unknown chat input commands. Matching by command id (not name) is
 * collision-proof against future commands of the bot's own and against
 * case differences with citext tag names.
 */
@ApplyOptions<ListenerOptions>({
  event: Events.UnknownChatInputCommand,
})
export class GuildTagCommandRunListener extends Listener {
  public async run(payload: UnknownChatInputCommandPayload) {
    const { interaction } = payload
    if (!interaction.guildId) return

    // Promoted commands outlive any one invocation of /tag, so the tag
    // command's own gate can't reach them; they get their own kill switch.
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
    // Guild check is belt and braces: command ids are unique, but a tag
    // must never render outside its own guild.
    if (!tag || tag.guildId !== BigInt(interaction.guildId)) {
      executionsCounter.add(1, { outcome: 'orphaned' })
      await interaction.reply({
        content: (await resolveKey(
          interaction,
          'commands/tag:promotedCommandGone',
        )) as string,
        flags: MessageFlags.Ephemeral,
      })
      // Best effort; reconciliation mops up commands this misses.
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
