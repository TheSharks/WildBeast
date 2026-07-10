import { Command } from '@sapphire/framework'
import { withExperimentOutcomes } from '../features/experiments.mjs'
import { installCommandFeatureGate } from '../features/gates.mjs'
import { installIdHintTracking } from '../utils/idHints.mjs'
import {
  attributesFromInteraction,
  spanName,
  withInteractionSpan,
} from '../utils/tracing.mjs'

/**
 * Command base class that runs every command inside an active OpenTelemetry
 * span and an isolated Sentry scope. Subclasses override `chatInputRun` /
 * `contextMenuRun` exactly like a regular Sapphire command; the constructor
 * wraps whichever handlers the subclass defines, so database and HTTP spans
 * created during the command nest under the command span and Sentry
 * breadcrumbs/user context stay per-interaction.
 */
export abstract class TracedCommand extends Command {
  public constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, options)

    installIdHintTracking(this)
    installCommandFeatureGate(this)

    const chatInputRun = this.chatInputRun?.bind(this)
    if (chatInputRun) {
      this.chatInputRun = (interaction, runContext) =>
        withInteractionSpan(
          spanName(`command.${this.name}`),
          interaction,
          {
            ...attributesFromInteraction(interaction, this),
            'discord.command.name': this.name,
            'discord.command.type': 'chat_input',
            'sentry.op': 'discord.command',
          },
          () =>
            withExperimentOutcomes({ kind: 'command', name: this.name }, () =>
              chatInputRun(interaction, runContext),
            ),
        )
    }

    const contextMenuRun = this.contextMenuRun?.bind(this)
    if (contextMenuRun) {
      this.contextMenuRun = (interaction, runContext) =>
        withInteractionSpan(
          spanName(`command.${this.name}`),
          interaction,
          {
            ...attributesFromInteraction(
              interaction as unknown as Parameters<
                typeof attributesFromInteraction
              >[0],
              this,
            ),
            'discord.command.name': this.name,
            'discord.command.type': 'context_menu',
            'sentry.op': 'discord.command',
          },
          () =>
            withExperimentOutcomes({ kind: 'command', name: this.name }, () =>
              contextMenuRun(interaction, runContext),
            ),
        )
    }
  }
}
