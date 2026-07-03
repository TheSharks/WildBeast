import { ApplyOptions } from '@sapphire/decorators'
import type { ListenerOptions } from '@sapphire/framework'
import { Listener } from '@sapphire/framework'
import { ScheduledTaskEvents } from '@sapphire/plugin-scheduled-tasks'
import type { ClientEvents } from 'discord.js'

@ApplyOptions<ListenerOptions>({
  event: ScheduledTaskEvents.ScheduledTaskFinished,
})
export class TaskFinishedListener extends Listener {
  public run(...[task, duration]: ClientEvents['scheduledTaskFinished']): void {
    this.container.logger.debug(
      `Task ${task.name} has finished${duration === null ? '' : ` in ${Math.round(duration)}ms`}.`,
    )
  }
}
