import { ApplyOptions } from '@sapphire/decorators'
import type { ListenerOptions } from '@sapphire/framework'
import { Events, Listener } from '@sapphire/framework'
import * as Sentry from '@sentry/node'
import type { ClientEvents } from 'discord.js'
import {
  attributesFromInteraction,
  updateActiveSpan,
} from '../../utils/tracing.mjs'

@ApplyOptions<ListenerOptions>({
  event: Events.PreChatInputCommandRun,
})
export class SentryBeforeChatInputListener extends Listener {
  public run(
    ...[{ interaction }]: ClientEvents['preChatInputCommandRun']
  ): void {
    updateActiveSpan({
      attributes: {
        ...attributesFromInteraction(interaction, this),
        'discord.command.name': interaction.commandName,
      },
      event: {
        name: 'command.before',
      },
    })

    this.container.logger.info(
      `Got an interaction for a chat input command: ${interaction.commandName}`,
    )
    Sentry.setUser({
      id: interaction.user.id,
      username: interaction.user.tag,
    })
    Sentry.setTag('command', interaction.commandName)
    Sentry.setContext('interaction', {
      id: interaction.id,
      type: interaction.type,
      commandName: interaction.commandName,
    })
    if (interaction.inGuild()) {
      Sentry.setContext('guild', {
        id: interaction.guildId,
        name: interaction.guild?.name,
      })
      Sentry.setContext('channel', {
        id: interaction.channelId,
        name: interaction.channel?.name,
        type: interaction.channel?.type,
      })
    } else {
      Sentry.setContext('dm', {
        channelId: interaction.channelId,
      })
    }
  }
}
