import { ApplyOptions } from '@sapphire/decorators'
import type { ListenerOptions } from '@sapphire/framework'
import { Listener } from '@sapphire/framework'
import { ScheduledTaskEvents } from '@sapphire/plugin-scheduled-tasks'
import { captureException } from '@sentry/node'
import { SpanStatusCode } from '@thesharks/analytics'
import type { ClientEvents } from 'discord.js'
import { clearTaskSpan, getTaskSpan } from '../../utils/taskSpans.mjs'

@ApplyOptions<ListenerOptions>({
  event: ScheduledTaskEvents.ScheduledTaskError,
})
export class LoggingReadyListener extends Listener {
  public run(...[error, task]: ClientEvents['scheduledTaskError']): void {
    const msg = error instanceof Error ? error.message : String(error)
    this.container.logger.error(
      `Task ${task.name} encountered an error: ${msg}`,
    )

    const span = getTaskSpan(task)
    if (span) {
      span.recordException(error as Error)
      span.setStatus({ code: SpanStatusCode.ERROR })
      span.end()
      clearTaskSpan(task)
    }

    captureException(error, {
      extra: {
        task: task.name,
      },
    })
  }
}
