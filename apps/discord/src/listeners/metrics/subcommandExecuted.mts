import { Listener } from '@sapphire/framework'
import { DURATION_SECONDS_BOUNDARIES, metrics } from '@thesharks/analytics'
import type { ClientEvents } from 'discord.js'
import { completeExperimentOutcomes } from '../../features/experiments.mjs'
import {
  commandMetricLabels,
  interactionDurationSeconds,
} from '../../utils/tracing.mjs'

const meter = metrics.getMeter('@thesharks/discord')
// Labels frozen by METRIC_CONTRACT['discord_commands_total'] in
// packages/analytics/src/utils/metrics.ts (adds optional `subcommand`).
const commandCounter = meter.createCounter('discord_commands_total', {
  description: 'Total number of Discord commands executed',
})
// Labels frozen by METRIC_CONTRACT['discord_command_duration_seconds'] in
// packages/analytics/src/utils/metrics.ts (adds optional `subcommand`).
const executionTime = meter.createHistogram(
  'discord_command_duration_seconds',
  {
    description: 'Time since interaction creation (includes network latency)',
    unit: 's',
    advice: { explicitBucketBoundaries: DURATION_SECONDS_BOUNDARIES },
  },
)

/** Subcommand plugin emits its own event; mirror into same metrics. */
export class SubcommandExecutedListener extends Listener {
  public constructor(
    context: Listener.LoaderContext,
    options: Listener.Options,
  ) {
    super(context, {
      ...options,
      event: 'chatInputSubcommandSuccess',
    })
  }

  public run(
    ...[
      interaction,
      subcommand,
      payload,
    ]: ClientEvents['chatInputSubcommandSuccess']
  ) {
    completeExperimentOutcomes('success')
    const labels = commandMetricLabels(
      interaction,
      payload.command.name,
      this,
      { subcommand: subcommand.name },
    )

    commandCounter.add(1, labels)

    executionTime.record(interactionDurationSeconds(interaction), {
      ...labels,
      duration_scope: 'interaction',
    })
  }
}
