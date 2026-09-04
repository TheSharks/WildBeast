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

const taskStartTimes = new Map<string, number>()

function taskKey(task: { name?: string }): string {
  return task?.name ?? 'unknown'
}

/** For tests: inspect or reset pending start times. */
export function __clearTaskStartTimes(): void {
  taskStartTimes.clear()
}

export function __setTaskStartTimeForTest(
  taskName: string,
  startTime: number,
): void {
  taskStartTimes.set(taskName, startTime)
}

// Pieces default their name to the file name; multiple listeners in one file
// need explicit names or each insert unloads the previous one.
@ApplyOptions<ListenerOptions>({
  name: 'taskRunMetrics',
  event: ScheduledTaskEvents.ScheduledTaskRun,
})
export class TaskRunMetricsListener extends Listener {
  public run(...[task]: ClientEvents['scheduledTaskRun']): void {
    taskStartTimes.set(taskKey(task), Date.now())
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
    taskStartTimes.delete(name)
    taskCounter.add(1, { task: name, status: 'success' })
    taskDuration.record(duration / 1000, { task: name, status: 'success' })
  }
}

@ApplyOptions<ListenerOptions>({
  name: 'taskErrorMetrics',
  event: ScheduledTaskEvents.ScheduledTaskError,
})
export class TaskErrorMetricsListener extends Listener {
  public run(...[, task]: ClientEvents['scheduledTaskError']): void {
    const name = taskKey(task)
    const started = taskStartTimes.get(name)
    taskStartTimes.delete(name)
    taskCounter.add(1, { task: name, status: 'error' })
    if (started !== undefined) {
      taskDuration.record(Math.max(0, Date.now() - started) / 1000, {
        task: name,
        status: 'error',
      })
    } else {
      // No Run event observed (e.g. hot reload); still record a duration so
      // failure latency stays visible, labelled by status.
      taskDuration.record(0, { task: name, status: 'error' })
    }
  }
}
