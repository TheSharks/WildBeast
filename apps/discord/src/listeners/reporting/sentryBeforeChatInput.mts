import { ApplyOptions } from '@sapphire/decorators'
import type { ListenerOptions } from '@sapphire/framework'
import { Events, Listener } from '@sapphire/framework'
import type { ClientEvents } from 'discord.js'

@ApplyOptions<ListenerOptions>({
  event: Events.PreChatInputCommandRun,
})
export class SentryBeforeChatInputListener extends Listener {
  public run(
    ...[{ interaction }]: ClientEvents['preChatInputCommandRun']
  ): void {
    // Sentry user/tag/context is applied per-interaction by TracedCommand's
    // isolation scope and by the error listeners at capture time; setting it
    // globally here would leak between concurrently running interactions.
    // Debug: per-interaction chatter must not spam info logs.
    this.container.logger.debug(
      `Got an interaction for a chat input command: ${interaction.commandName}`,
    )
  }
}
