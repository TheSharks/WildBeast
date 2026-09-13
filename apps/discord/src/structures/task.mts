import { container } from '@sapphire/framework'
import { ScheduledTask } from '@sapphire/plugin-scheduled-tasks'
import * as Sentry from '@sentry/node'
import { taskGateKey } from '../features/registry.mjs'
import { ownsTask } from '../runtime/task-queue.mjs'
import { WorkRejected } from '../runtime/work.mjs'
import { spanName, withSpan } from '../telemetry/spans.mjs'
import { monitorConfigFromSchedule, monitorSlug } from '../utils/crons.mjs'

/** BullMQ can retry after this worker has restarted. */
export class TaskDeferred extends Error {
  public constructor(reason: string) {
    super(`Task deferred: ${reason}`)
    this.name = 'TaskDeferred'
  }
}

export interface AppScheduledTaskOptions extends ScheduledTask.Options {
  /**
   * Cluster-dependent work: only the worker holding this shard may run the
   * job. Other workers do not register its schedule.
   */
  requiresShard?: number
}

/** Shared by repeat schedules and one-off boot jobs. */
export const TASK_JOB_OPTIONS = {
  attempts: 30,
  backoff: { type: 'fixed', delay: 30_000 },
  removeOnComplete: true,
  removeOnFail: 50,
} as const

/**
 * Every scheduled task run is admitted through the runtime (so draining waits
 * for it), gated by its runtime flag, traced, and checked in as a Sentry
 * monitor. Each worker has its own queue; shard-bound schedules only exist
 * on their owner.
 */
export abstract class AppScheduledTask extends ScheduledTask {
  public readonly requiresShard: number | undefined

  public constructor(
    context: ScheduledTask.LoaderContext,
    options: AppScheduledTaskOptions,
  ) {
    super(context, {
      ...options,
      ...(!ownsTask(container.app.config.shardIds, options.requiresShard)
        ? { interval: undefined, pattern: undefined }
        : {}),
      customJobOptions: {
        ...TASK_JOB_OPTIONS,
        ...options.customJobOptions,
      },
    })
    this.requiresShard = options.requiresShard
    const monitor = monitorConfigFromSchedule(this)
    const slug = monitorSlug(this.name)
    const gateKey = taskGateKey(this.name)
    const run = this.run.bind(this)
    this.run = (payload) =>
      Sentry.withIsolationScope(async (scope) => {
        scope.setTag('task', this.name)
        const app = this.container.app
        if (
          this.requiresShard !== undefined &&
          !this.container.client.ws.shards.has(this.requiresShard)
        ) {
          throw new Error(
            `${this.name} requires shard ${this.requiresShard}, which this worker does not own`,
          )
        }
        const execute = () =>
          withSpan(
            spanName(`task.${this.name}`),
            { 'discord.task.name': this.name, 'sentry.op': 'discord.task' },
            () =>
              app.experiments.run(
                { kind: 'task', name: this.name },
                async () => {
                  if (
                    gateKey &&
                    !(await app.flags.enabled(gateKey, {
                      targetingKey: `task:${this.name}`,
                      task: this.name,
                    }))
                  ) {
                    this.container.logger.debug(
                      `Scheduled task ${this.name} disabled by ${gateKey}`,
                    )
                    return undefined
                  }
                  return run(payload)
                },
              ),
          )
        try {
          return await app.work.run(() =>
            monitor ? Sentry.withMonitor(slug, execute, monitor) : execute(),
          )
        } catch (error) {
          if (error instanceof WorkRejected)
            throw new TaskDeferred('this worker is stopping')
          throw error
        }
      })
  }
}
