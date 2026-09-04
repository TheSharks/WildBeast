import type { ChatInputCommandErrorPayload } from '@sapphire/framework'
import { Listener } from '@sapphire/framework'
import { metrics } from '@thesharks/analytics'
import { commandMetricLabels } from '../../utils/tracing.mjs'

const meter = metrics.getMeter('@thesharks/discord')
const errorCounter = meter.createCounter('discord_command_errors_total', {
  description: 'Total number of Discord command errors',
})

export class CommandErrorListener extends Listener {
  public constructor(
    context: Listener.LoaderContext,
    options: Listener.Options,
  ) {
    super(context, {
      ...options,
      event: 'chatInputCommandError',
    })
  }

  public run(payload: ChatInputCommandErrorPayload) {
    errorCounter.add(
      1,
      commandMetricLabels(
        payload.interaction,
        payload.command?.name ?? 'unknown',
        this,
      ),
    )
  }
}
