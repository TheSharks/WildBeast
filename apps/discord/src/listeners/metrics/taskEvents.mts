import { ApplyOptions } from '@sapphire/decorators'
import type { ListenerOptions } from '@sapphire/framework'
import { Listener } from '@sapphire/framework'
import { ScheduledTaskEvents } from '@sapphire/plugin-scheduled-tasks'
import { DURATION_SECONDS_BOUNDARIES, metrics } from '@thesharks/analytics'
import type { ClientEvents } from 'discord.js'
import { TaskDeferred } from '../../structures/task.mjs'

const meter = metrics.getMeter('@thesharks/discord')
// Labels frozen by METRIC_CONTRACT['discord_tasks_total'].
const taskCounter = meter.createCounter('discord_tasks_total', {
  description: 'Total number of scheduled task runs by status',
})
// Labels frozen by METRIC_CONTRACT['discord_task_duration_seconds'].
const taskDuration = meter.createHistogram('discord_task_duration_seconds', {
  description: 'Scheduled task run duration',
  unit: 's',
  advice: { explicitBucketBoundaries: DURATION_SECONDS_BOUNDARIES },
})

const startTimes = new Map<string, number>()
const taskKey = (task: { name?: string }) => task?.name ?? 'unknown'

@ApplyOptions<ListenerOptions>({
  name: 'taskRunMetrics',
  event: ScheduledTaskEvents.ScheduledTaskRun,
})
export class TaskRunMetricsListener extends Listener {
  public run(...[task]: ClientEvents['scheduledTaskRun']): void {
    startTimes.set(taskKey(task), Date.now())
  }
}

@ApplyOptions<ListenerOptions>({
  name: 'taskSuccessMetrics',
  event: ScheduledTaskEvents.ScheduledTaskSuccess,
})
export class TaskSuccessMetricsListener extends Listener {
  public run(
    ...[task, , , duration]: ClientEvents['scheduledTaskSuccess']
  ): void {
    const name = taskKey(task)
    startTimes.delete(name)
    taskCounter.add(1, { task: name, status: 'success' })
    taskDuration.record(duration / 1000, { task: name, status: 'success' })
  }
}

@ApplyOptions<ListenerOptions>({
  name: 'taskErrorMetrics',
  event: ScheduledTaskEvents.ScheduledTaskError,
})
export class TaskErrorMetricsListener extends Listener {
  public run(...[error, task]: ClientEvents['scheduledTaskError']): void {
    const name = taskKey(task)
    const started = startTimes.get(name)
    startTimes.delete(name)
    // A deferral is routing, not a failure of the task itself.
    const status = error instanceof TaskDeferred ? 'deferred' : 'error'
    taskCounter.add(1, { task: name, status })
    taskDuration.record(
      started === undefined ? 0 : Math.max(0, Date.now() - started) / 1000,
      { task: name, status },
    )
  }
}
