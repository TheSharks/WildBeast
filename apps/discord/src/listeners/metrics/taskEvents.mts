import { ApplyOptions } from '@sapphire/decorators'
import type { ListenerOptions } from '@sapphire/framework'
import { Listener } from '@sapphire/framework'
import { ScheduledTaskEvents } from '@sapphire/plugin-scheduled-tasks'
import { DURATION_SECONDS_BOUNDARIES, metrics } from '@thesharks/analytics'
import type { ClientEvents } from 'discord.js'

const meter = metrics.getMeter('@thesharks/discord')
const taskCounter = meter.createCounter('discord_tasks_total', {
  description: 'Total number of scheduled task runs by status',
})
const taskDuration = meter.createHistogram('discord_task_duration_seconds', {
  description: 'Scheduled task run duration',
  unit: 's',
  advice: { explicitBucketBoundaries: DURATION_SECONDS_BOUNDARIES },
})

// Pieces default their name to the file name; multiple listeners in one file
// need explicit names or each insert unloads the previous one.
@ApplyOptions<ListenerOptions>({
  name: 'taskSuccessMetrics',
  event: ScheduledTaskEvents.ScheduledTaskSuccess,
})
export class TaskSuccessMetricsListener extends Listener {
  public run(
    ...[task, , , duration]: ClientEvents['scheduledTaskSuccess']
  ): void {
    taskCounter.add(1, { task: task.name, status: 'success' })
    taskDuration.record(duration / 1000, { task: task.name })
  }
}

@ApplyOptions<ListenerOptions>({
  name: 'taskErrorMetrics',
  event: ScheduledTaskEvents.ScheduledTaskError,
})
export class TaskErrorMetricsListener extends Listener {
  public run(...[, task]: ClientEvents['scheduledTaskError']): void {
    taskCounter.add(1, { task: task.name, status: 'error' })
  }
}
