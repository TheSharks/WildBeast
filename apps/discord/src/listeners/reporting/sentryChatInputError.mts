import { ApplyOptions } from '@sapphire/decorators'
import type { ListenerOptions } from '@sapphire/framework'
import { Events, Listener } from '@sapphire/framework'
import * as Sentry from '@sentry/node'
import type { ClientEvents } from 'discord.js'
import { sendErrorReport } from '../../utils/errorResponse.mjs'
import {
  applyInteractionScope,
  attributesFromInteraction,
  withSpan,
} from '../../utils/tracing.mjs'

@ApplyOptions<ListenerOptions>({
  event: Events.ChatInputCommandError,
})
export class SentryChatInputErrorListener extends Listener {
  public async run(...[error, payload]: ClientEvents['chatInputCommandError']) {
    return withSpan(
      'discord.command.error_reporting',
      {
        ...attributesFromInteraction(payload.interaction, this),
        'discord.command.name': payload.interaction.commandName,
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
