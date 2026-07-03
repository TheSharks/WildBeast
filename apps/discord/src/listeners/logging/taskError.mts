import { ApplyOptions } from '@sapphire/decorators'
import type { ListenerOptions } from '@sapphire/framework'
import { Listener } from '@sapphire/framework'
import { ScheduledTaskEvents } from '@sapphire/plugin-scheduled-tasks'
import * as Sentry from '@sentry/node'
import type { ClientEvents } from 'discord.js'

@ApplyOptions<ListenerOptions>({
  event: ScheduledTaskEvents.ScheduledTaskError,
})
export class TaskErrorListener extends Listener {
  public run(...[error, task]: ClientEvents['scheduledTaskError']): void {
    const msg = error instanceof Error ? error.message : String(error)
    this.container.logger.error(
      `Task ${task.name} encountered an error: ${msg}`,
    )

    Sentry.withScope((scope) => {
      scope.setTag('task', task.name)
      Sentry.captureException(error, {
        extra: {
          task: task.name,
        },
      })
    })
  }
}
