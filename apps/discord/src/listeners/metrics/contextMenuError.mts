import type { ContextMenuCommandErrorPayload } from '@sapphire/framework'
import { Listener } from '@sapphire/framework'
import { metrics } from '@thesharks/analytics'
import { commandMetricLabels } from '../../utils/tracing.mjs'

const meter = metrics.getMeter('@thesharks/discord')
const errorCounter = meter.createCounter(
  'discord_context_command_errors_total',
  {
    description: 'Total number of Discord context menu command errors',
  },
)

export class ContextMenuErrorListener extends Listener {
  public constructor(
    context: Listener.LoaderContext,
    options: Listener.Options,
  ) {
    super(context, {
      ...options,
      event: 'contextMenuCommandError',
    })
  }

  public run(payload: ContextMenuCommandErrorPayload) {
    errorCounter.add(
      1,
      commandMetricLabels(payload.interaction, payload.command?.name, this),
    )
  }
}
