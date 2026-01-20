import { ApplyOptions } from '@sapphire/decorators'
import type { ListenerOptions } from '@sapphire/framework'
import { Events, Listener } from '@sapphire/framework'
import type { ClientEvents } from 'discord.js'
import { spanName, withSpan } from '../../utils/tracing.mjs'

@ApplyOptions<ListenerOptions>({
  event: Events.ClientReady,
})
export class LoggingReadyListener extends Listener {
  public run(...[data]: ClientEvents['ready']): void {
    void withSpan(
      spanName('listener'),
      {
        'discord.listener.name': this.name,
        'discord.listener.event': Events.ClientReady,
      },
      () => {
        this.container.logger.info(
          `Ready! Logged in as ${data.user.tag} (${data.user.id})`,
        )
      },
    )
  }
}
