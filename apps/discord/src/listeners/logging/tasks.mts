import { ApplyOptions } from '@sapphire/decorators'
import type { ListenerOptions } from '@sapphire/framework'
import { Listener } from '@sapphire/framework'
import { ScheduledTaskEvents } from '@sapphire/plugin-scheduled-tasks'
import * as Sentry from '@sentry/node'
import type { ClientEvents } from 'discord.js'
import { TaskDeferred } from '../../structures/task.mjs'

@ApplyOptions<ListenerOptions>({
  name: 'taskRunLogging',
  event: ScheduledTaskEvents.ScheduledTaskRun,
})
export class TaskRunLoggingListener extends Listener {
  public run(...[task]: ClientEvents['scheduledTaskRun']): void {
    this.container.logger.debug(`Starting task ${task.name}.`)
  }
}

@ApplyOptions<ListenerOptions>({
  name: 'taskFinishedLogging',
  event: ScheduledTaskEvents.ScheduledTaskFinished,
})
export class TaskFinishedLoggingListener extends Listener {
  public run(...[task, duration]: ClientEvents['scheduledTaskFinished']): void {
    this.container.logger.debug(
      `Task ${task.name} has finished${duration === null ? '' : ` in ${Math.round(duration)}ms`}.`,
    )
  }
}

@ApplyOptions<ListenerOptions>({
  name: 'taskErrorLogging',
  event: ScheduledTaskEvents.ScheduledTaskError,
})
export class TaskErrorLoggingListener extends Listener {
  public run(...[error, task]: ClientEvents['scheduledTaskError']): void {
    if (error instanceof TaskDeferred) {
      this.container.logger.debug(
        `Task ${task.name} deferred: ${error.message}`,
      )
      return
    }
    const message = error instanceof Error ? error.message : String(error)
    this.container.logger.error(
      `Task ${task.name} encountered an error: ${message}`,
    )
    Sentry.withScope((scope) => {
      scope.setTag('task', task.name)
      Sentry.captureException(error, { extra: { task: task.name } })
    })
  }
}
