import { ApplyOptions } from '@sapphire/decorators'
import type {
  ListenerOptions,
  UnknownChatInputCommandPayload,
} from '@sapphire/framework'
import { Events, Listener } from '@sapphire/framework'
import { resolveKey } from '@sapphire/plugin-i18next'
import { metrics } from '@thesharks/analytics'
import { MessageFlags } from 'discord.js'
import { subjectFromInteraction } from '../../premium/interaction.mjs'
import { WorkRejected } from '../../runtime/work.mjs'
import { replyWithRenderedTag } from '../../tags/render.mjs'
import {
  attributesFromInteraction,
  spanName,
  withInteractionSpan,
} from '../../telemetry/spans.mjs'

const meter = metrics.getMeter('@thesharks/discord')
export const executionsCounter = meter.createCounter(
  'discord_guild_tag_command_executions_total',
  { description: 'Promoted guild tag command invocations' },
)

/** Promoted tags arrive as unknown commands; match by id, never by name. */
@ApplyOptions<ListenerOptions>({ event: Events.UnknownChatInputCommand })
export class GuildTagCommandRunListener extends Listener {
  public async run(payload: UnknownChatInputCommandPayload) {
    const { interaction } = payload
    if (!interaction.guildId) return
    const app = this.container.app
    try {
      await app.work.run(() =>
        withInteractionSpan(
          spanName('command.guild_tag'),
          interaction,
          {
            ...attributesFromInteraction(interaction, this),
            'discord.command.name': 'guild_tag',
            'discord.command.type': 'chat_input',
            'sentry.op': 'discord.command',
          },
          () => this.execute(payload),
        ),
      )
    } catch (error) {
      if (!(error instanceof WorkRejected)) throw error
    }
  }

  private async execute({ interaction }: UnknownChatInputCommandPayload) {
    const app = this.container.app
    const guildId = BigInt(interaction.guildId!)
    // Promoted commands outlive /tag invocations, so they need their own switch.
    const enabled = await app.flags.enabled(
      'features.tags.guildCommands',
      app.gates.flagContext(subjectFromInteraction(interaction), {
        command: interaction.commandName,
      }),
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
    const tag = await app.tags.resolve(guildId, BigInt(interaction.commandId))
    if (!tag) {
      executionsCounter.add(1, { outcome: 'orphaned' })
      await interaction.reply({
        content: (await resolveKey(
          interaction,
          'commands/tag:promotedCommandGone',
        )) as string,
        flags: MessageFlags.Ephemeral,
      })
      // Repair only removes commands the durable intents own.
      void app.tagReconciler
        .reconcileGuild(guildId, app.work.signal)
        .catch((error: unknown) =>
          this.container.logger.warn(
            `Could not repair tag commands for guild ${guildId}`,
            error,
          ),
        )
      return
    }
    const outcome = await replyWithRenderedTag(interaction, tag.content)
    executionsCounter.add(1, { outcome })
  }
}
