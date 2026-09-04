import { ApplyOptions } from '@sapphire/decorators'
import type { ListenerOptions } from '@sapphire/framework'
import { Listener } from '@sapphire/framework'
import { SubcommandPluginEvents } from '@sapphire/plugin-subcommands'
import type { ClientEvents } from 'discord.js'
import {
  attributesFromInteraction,
  captureInteractionError,
  withErrorSpan,
} from '../../utils/tracing.mjs'

/**
 * Same treatment as SentryChatInputErrorListener, for subcommand-based
 * commands: the subcommands plugin swallows chatInputCommandError and
 * emits its own event instead.
 */
@ApplyOptions<ListenerOptions>({
  event: SubcommandPluginEvents.ChatInputSubcommandError,
})
export class SentrySubcommandErrorListener extends Listener {
  public async run(
    ...[error, payload]: ClientEvents['chatInputSubcommandError']
  ) {
    const subcommand = payload.matchedSubcommandMapping?.name ?? 'unknown'
    return withErrorSpan(
      'discord.command.error_reporting',
      payload.interaction,
      {
        ...attributesFromInteraction(payload.interaction, this),
        'discord.command.name': payload.interaction.commandName,
        'discord.command.subcommand': subcommand,
      },
      () =>
        captureInteractionError(payload.interaction, error, {
          subcommand,
        }),
    )
  }
}
