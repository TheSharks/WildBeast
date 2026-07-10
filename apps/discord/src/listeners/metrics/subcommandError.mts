import { Listener } from '@sapphire/framework'
import { metrics } from '@thesharks/analytics'
import type { ClientEvents } from 'discord.js'
import { completeExperimentOutcomes } from '../../features/experiments.mjs'
import { commandMetricLabels } from '../../utils/tracing.mjs'

const meter = metrics.getMeter('@thesharks/discord')
const errorCounter = meter.createCounter('discord_command_errors_total', {
  description: 'Total number of Discord command errors',
})

/**
 * Subcommand-based commands don't emit chatInputCommandError; the
 * subcommands plugin emits its own event, so they need their own listener
 * to land in the same metrics.
 */
export class SubcommandErrorListener extends Listener {
  public constructor(
    context: Listener.LoaderContext,
    options: Listener.Options,
  ) {
    super(context, {
      ...options,
      event: 'chatInputSubcommandError',
    })
  }

  public run(...[, payload]: ClientEvents['chatInputSubcommandError']) {
    completeExperimentOutcomes('error')
    const labels = commandMetricLabels(
      payload.interaction,
      payload.command?.name,
      this,
      { subcommand: payload.matchedSubcommandMapping.name },
    )
    errorCounter.add(1, labels)
  }
}
