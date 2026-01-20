import { inspect } from 'node:util'
import { ApplyOptions } from '@sapphire/decorators'
import type { ListenerOptions } from '@sapphire/framework'
import { Events, Listener } from '@sapphire/framework'
import type { ClientEvents } from 'discord.js'
import { spanName, withSpan } from '../../utils/tracing.mjs'

@ApplyOptions<ListenerOptions>({
  event: Events.Raw,
})
export class LoggingRawListener extends Listener {
  public run(...[data]: ClientEvents['raw']): void {
    void withSpan(
      spanName('listener'),
      {
        'discord.listener.name': this.name,
        'discord.listener.event': Events.Raw,
      },
      () => {
        this.container.logger.debug(inspect(data))
      },
    )
  }
}
