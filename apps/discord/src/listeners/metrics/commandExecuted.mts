import type { ChatInputCommandSuccessPayload } from '@sapphire/framework'
import { Listener } from '@sapphire/framework'
import { DURATION_SECONDS_BOUNDARIES, metrics } from '@thesharks/analytics'
import {
  commandMetricLabels,
  interactionDurationSeconds,
} from '../../utils/tracing.mjs'

const meter = metrics.getMeter('@thesharks/discord')
const commandCounter = meter.createCounter('discord_commands_total', {
  description: 'Total number of Discord commands executed',
})
const executionTime = meter.createHistogram(
  'discord_command_duration_seconds',
  {
    description: 'Time since interaction creation (includes network latency)',
    unit: 's',
    advice: { explicitBucketBoundaries: DURATION_SECONDS_BOUNDARIES },
  },
)

export class CommandExecutedListener extends Listener {
  public constructor(
    context: Listener.LoaderContext,
    options: Listener.Options,
  ) {
    super(context, {
      ...options,
      event: 'chatInputCommandSuccess',
    })
  }

  public run(payload: ChatInputCommandSuccessPayload) {
    const labels = commandMetricLabels(
      payload.interaction,
      payload.command.name,
      this,
    )

    commandCounter.add(1, labels)

    executionTime.record(interactionDurationSeconds(payload.interaction), {
      ...labels,
      duration_scope: 'interaction',
    })
  }
}
