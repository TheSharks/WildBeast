import { ApplyOptions } from '@sapphire/decorators'
import type { ListenerOptions } from '@sapphire/framework'
import { Listener } from '@sapphire/framework'
import { ScheduledTaskEvents } from '@sapphire/plugin-scheduled-tasks'
import type { ClientEvents } from 'discord.js'
import { setTaskSpan } from '../../utils/taskSpans.mjs'
import { getTracer, spanName } from '../../utils/tracing.mjs'

@ApplyOptions<ListenerOptions>({
  event: ScheduledTaskEvents.ScheduledTaskRun,
})
export class LoggingReadyListener extends Listener {
  public run(...[task]: ClientEvents['scheduledTaskRun']): void {
    this.container.logger.debug(`Starting task ${task.name}.`)

    const tracer = getTracer()
    const span = tracer.startSpan(spanName('task'))
    span.setAttribute('discord.task.name', task.name)

    setTaskSpan(task, span)
  }
}
