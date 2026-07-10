import type { ContextMenuCommandSuccessPayload } from '@sapphire/framework'
import { Listener } from '@sapphire/framework'
import { DURATION_SECONDS_BOUNDARIES, metrics } from '@thesharks/analytics'
import {
  commandMetricLabels,
  interactionDurationSeconds,
} from '../../utils/tracing.mjs'

const meter = metrics.getMeter('@thesharks/discord')
const commandCounter = meter.createCounter('discord_context_commands_total', {
  description: 'Total number of Discord context menu commands executed',
})
const executionTime = meter.createHistogram(
  'discord_context_command_duration_seconds',
  {
    description:
      'Time since context menu command interaction creation (includes network latency)',
    unit: 's',
    advice: { explicitBucketBoundaries: DURATION_SECONDS_BOUNDARIES },
  },
)

export class ContextMenuExecutedListener extends Listener {
  public constructor(
    context: Listener.LoaderContext,
    options: Listener.Options,
  ) {
    super(context, {
      ...options,
      event: 'contextMenuCommandSuccess',
    })
  }

  public run(payload: ContextMenuCommandSuccessPayload) {
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
