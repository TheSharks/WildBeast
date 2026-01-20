import { ApplyOptions } from '@sapphire/decorators'
import type { ListenerOptions } from '@sapphire/framework'
import { Listener } from '@sapphire/framework'
import { ScheduledTaskEvents } from '@sapphire/plugin-scheduled-tasks'
import { SpanStatusCode } from '@thesharks/analytics'
import type { ClientEvents } from 'discord.js'
import { clearTaskSpan, getTaskSpan } from '../../utils/taskSpans.mjs'

@ApplyOptions<ListenerOptions>({
  event: ScheduledTaskEvents.ScheduledTaskFinished,
})
export class LoggingReadyListener extends Listener {
  public run(...[task]: ClientEvents['scheduledTaskRun']): void {
    this.container.logger.debug(`Task ${task.name} has finished.`)

    const span = getTaskSpan(task)
    if (span) {
      span.setStatus({ code: SpanStatusCode.OK })
      span.end()
      clearTaskSpan(task)
    }
  }
}
