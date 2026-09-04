import { ApplyOptions } from '@sapphire/decorators'
import type { ListenerOptions } from '@sapphire/framework'
import { Events, Listener } from '@sapphire/framework'
import type { ClientEvents } from 'discord.js'
import {
  attributesFromInteraction,
  captureInteractionError,
  withErrorSpan,
} from '../../utils/tracing.mjs'

@ApplyOptions<ListenerOptions>({
  event: Events.ChatInputCommandError,
})
export class SentryChatInputErrorListener extends Listener {
  public async run(...[error, payload]: ClientEvents['chatInputCommandError']) {
    return withErrorSpan(
      'discord.command.error_reporting',
      payload.interaction,
      {
        ...attributesFromInteraction(payload.interaction, this),
        'discord.command.name': payload.interaction.commandName,
      },
      () => captureInteractionError(payload.interaction, error),
    )
  }
}
