import { ApplyOptions } from '@sapphire/decorators'
import type { ListenerOptions } from '@sapphire/framework'
import { Events, Listener } from '@sapphire/framework'
import type { ClientEvents } from 'discord.js'
import {
  attributesFromInteraction,
  captureInteractionError,
  withSpan,
} from '../../utils/tracing.mjs'

@ApplyOptions<ListenerOptions>({
  event: Events.ContextMenuCommandError,
})
export class SentryContextCommandErrorListener extends Listener {
  public async run(
    ...[error, payload]: ClientEvents['contextMenuCommandError']
  ) {
    return withSpan(
      'discord.context_command.error_reporting',
      {
        ...attributesFromInteraction(
          payload.interaction as unknown as Parameters<
            typeof attributesFromInteraction
          >[0],
          this,
        ),
        'discord.command.name': payload.interaction.commandName,
      },
      () => captureInteractionError(payload.interaction, error),
    )
  }
}
