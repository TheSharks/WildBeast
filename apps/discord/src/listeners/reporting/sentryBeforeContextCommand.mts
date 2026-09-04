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
    // Scope is per-interaction elsewhere; global set would leak across interactions.
    this.container.logger.debug(
      `Got an interaction for a context menu command: ${interaction.commandName}`,
    )
  }
}
