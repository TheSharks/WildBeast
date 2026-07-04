import { ApplyOptions } from '@sapphire/decorators'
import type { ListenerOptions } from '@sapphire/framework'
import { Listener } from '@sapphire/framework'
import { SubcommandPluginEvents } from '@sapphire/plugin-subcommands'
import * as Sentry from '@sentry/node'
import type { ClientEvents } from 'discord.js'
import { sendErrorReport } from '../../utils/errorResponse.mjs'
import {
  applyInteractionScope,
  attributesFromInteraction,
  withSpan,
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
    return withSpan(
      'discord.command.error_reporting',
      {
        ...attributesFromInteraction(payload.interaction, this),
        'discord.command.name': payload.interaction.commandName,
        'discord.command.subcommand': payload.matchedSubcommandMapping.name,
      },
      async () => {
        const { interaction } = payload
        // Set everything on a local scope at capture time: the isolation
        // scope is shared between concurrently running interactions, so
        // global setUser/setTag would attribute errors to the wrong user.
        const uuid = Sentry.withScope((scope) => {
          applyInteractionScope(scope, interaction)
          scope.addBreadcrumb({
            category: 'command',
            level: 'error',
            message: error instanceof Error ? error.message : String(error),
            data: {
              commandName: interaction.commandName,
              subcommand: payload.matchedSubcommandMapping.name,
              userId: interaction.user.id,
            },
          })
          return Sentry.captureException(error)
        })
        await sendErrorReport(interaction, error, uuid)
      },
    )
  }
}
