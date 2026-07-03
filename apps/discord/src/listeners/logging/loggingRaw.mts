import { inspect } from 'node:util'
import { ApplyOptions } from '@sapphire/decorators'
import type { ListenerOptions } from '@sapphire/framework'
import { Events, Listener, LogLevel } from '@sapphire/framework'
import type { ClientEvents } from 'discord.js'

@ApplyOptions<ListenerOptions>({
  event: Events.Raw,
})
export class LoggingRawListener extends Listener {
  public run(...[data]: ClientEvents['raw']): void {
    // This fires for every gateway packet; skip the inspect() unless debug
    // logging is actually enabled.
    if (!this.container.logger.has(LogLevel.Debug)) {
      return
    }

    this.container.logger.debug(inspect(data))
  }
}
