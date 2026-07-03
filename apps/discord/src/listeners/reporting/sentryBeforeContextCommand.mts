import { ApplyOptions } from '@sapphire/decorators'
import type { ListenerOptions } from '@sapphire/framework'
import { Events, Listener } from '@sapphire/framework'
import type { ClientEvents } from 'discord.js'

@ApplyOptions<ListenerOptions>({
  event: Events.PreContextMenuCommandRun,
})
export class SentryBeforeContextCommandListener extends Listener {
  public run(
    ...[{ interaction }]: ClientEvents['preContextMenuCommandRun']
  ): void {
    // Sentry user/tag/context is applied per-interaction by TracedCommand's
    // isolation scope and by the error listeners at capture time; setting it
    // globally here would leak between concurrently running interactions.
    this.container.logger.info(
      `Got an interaction for a context menu command: ${interaction.commandName}`,
    )
  }
}
