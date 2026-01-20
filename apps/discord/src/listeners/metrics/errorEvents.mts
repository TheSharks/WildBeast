import { ApplyOptions } from '@sapphire/decorators'
import type { ListenerOptions } from '@sapphire/framework'
import { Events, Listener } from '@sapphire/framework'
import { metrics, SpanStatusCode, trace } from '@thesharks/analytics'
import type { ClientEvents } from 'discord.js'
import { updateActiveSpan } from '../../utils/tracing.mjs'

const meter = metrics.getMeter('@thesharks/discord')
const warnCounter = meter.createCounter('discord_warnings_total', {
  description: 'Total number of Discord warnings',
})
const errorCounter = meter.createCounter('discord_errors_total', {
  description: 'Total number of Discord errors',
})

@ApplyOptions<ListenerOptions>({
  event: Events.Warn,
})
export class WarnListener extends Listener {
  public run(...[message]: ClientEvents['warn']): void {
    const span = trace.getActiveSpan()
    if (span) {
      span.recordException(new Error(message))
      span.setStatus({ code: SpanStatusCode.ERROR })
    }

    warnCounter.add(1, {
      message: String(message).slice(0, 100),
    })
  }
}

@ApplyOptions<ListenerOptions>({
  event: Events.Error,
})
export class ErrorListener extends Listener {
  public run(...[error]: ClientEvents['error']): void {
    const span = trace.getActiveSpan()
    if (span) {
      span.recordException(error)
      span.setStatus({ code: SpanStatusCode.ERROR })
    }

    errorCounter.add(1, {
      error_type: error?.name ?? 'unknown',
    })
  }
}
