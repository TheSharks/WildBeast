import { Subcommand } from '@sapphire/plugin-subcommands'
import { installIdHintTracking } from '../utils/idHints.mjs'
import {
  attributesFromInteraction,
  spanName,
  withInteractionSpan,
} from '../utils/tracing.mjs'

/**
 * Subcommand base class with the same telemetry treatment as
 * `TracedCommand`: the plugin's dispatcher runs inside an active
 * OpenTelemetry span and an isolated Sentry scope, so every mapped
 * subcommand method inherits them without wrapping each one.
 */
export abstract class TracedSubcommand extends Subcommand {
  public constructor(
    context: Subcommand.LoaderContext,
    options: Subcommand.Options,
  ) {
    super(context, options)

    installIdHintTracking(this)

    const chatInputRun = this.chatInputRun?.bind(this)
    if (chatInputRun) {
      this.chatInputRun = (interaction, runContext) =>
        withInteractionSpan(
          spanName(`command.${this.name}`),
          interaction,
          {
            ...attributesFromInteraction(interaction, this),
            'discord.command.name': this.name,
            'discord.command.subcommand':
              interaction.options.getSubcommand(false) ?? undefined,
            'discord.command.type': 'chat_input',
            'sentry.op': 'discord.command',
          },
          () => chatInputRun(interaction, runContext),
        )
    }
  }
}
