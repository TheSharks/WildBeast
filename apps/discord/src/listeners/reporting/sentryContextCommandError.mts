import { ApplyOptions } from '@sapphire/decorators'
import type { ListenerOptions } from '@sapphire/framework'
import { Events, Listener } from '@sapphire/framework'
import { resolveKey } from '@sapphire/plugin-i18next'
import * as Sentry from '@sentry/node'
import { type ClientEvents, Colors, EmbedBuilder } from 'discord.js'
import {
  applyInteractionScope,
  attributesFromInteraction,
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
        const embeds = [
          new EmbedBuilder()
            .setTitle(
              await resolveKey(payload.interaction, 'system/errors:oops'),
            )
            .setDescription(
              await resolveKey(payload.interaction, 'system/errors:try_again', {
                error: error instanceof Error ? error.message : String(error),
              }),
            )
            .setColor(Colors.Red)
            .setFooter({
              text: await resolveKey(
                payload.interaction,
                'system/errors:report',
              ),
            })
            .addFields({
              name: await resolveKey(
                payload.interaction,
                'system/errors:error_code',
              ),
              value: uuid,
            }),
        ]
        // A deferred interaction is acknowledged too; reply() would throw.
        if (payload.interaction.replied || payload.interaction.deferred) {
          await payload.interaction.editReply({
            content: '',
            components: [],
            embeds,
          })
        } else {
          await payload.interaction.reply({
            embeds,
            ephemeral: true,
          })
        }
      },
    )
  }
}
