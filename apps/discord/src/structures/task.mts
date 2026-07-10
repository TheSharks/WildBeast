import { ScheduledTask } from '@sapphire/plugin-scheduled-tasks'
import * as Sentry from '@sentry/node'
import { booleanFlagValue } from '../features/client.mjs'
import { taskFlagContext } from '../features/context.mjs'
import { withExperimentOutcomes } from '../features/experiments.mjs'
import { taskGateKey } from '../features/registry.mjs'
import { monitorConfigFromSchedule, monitorSlug } from '../utils/crons.mjs'
import { spanName, withSpan } from '../utils/tracing.mjs'

/**
 * ScheduledTask base class that runs every task inside an active
 * OpenTelemetry span and an isolated Sentry scope. Subclasses implement
 * `run` exactly like a regular scheduled task; the constructor wraps it, so
 * database/HTTP spans created during the task nest under the task span.
 *
 * Tasks with a derivable schedule (a cron pattern or a whole-minute
 * interval) also report Sentry cron check-ins, so missed or failing runs
 * alert even when they produce no exception. BullMQ runs each repeated job
 * on exactly one worker, so a run checks in once fleet-wide.
 */
export abstract class TracedScheduledTask extends ScheduledTask {
  public constructor(
    context: ScheduledTask.LoaderContext,
    options: ScheduledTask.Options,
  ) {
    super(context, options)

    const monitorConfig = monitorConfigFromSchedule(this)
    const slug = monitorSlug(this.name)
    const gateKey = taskGateKey(this.name)

    const run = this.run.bind(this)
    this.run = (payload) =>
      Sentry.withIsolationScope((scope) => {
        scope.setTag('task', this.name)
        const execute = () =>
          withSpan(
            spanName(`task.${this.name}`),
            {
              'discord.task.name': this.name,
              'sentry.op': 'discord.task',
            },
            () =>
              withExperimentOutcomes(
                { kind: 'task', name: this.name },
                async () => {
                  if (
                    gateKey &&
                    !(await booleanFlagValue(
                      gateKey,
                      taskFlagContext(this.name),
                    ))
                  ) {
                    this.container.logger?.debug(
                      `Scheduled task ${this.name} disabled by ${gateKey}`,
                    )
                    return undefined
                  }
                  return run(payload)
                },
              ),
          )
        return monitorConfig
          ? Sentry.withMonitor(slug, execute, monitorConfig)
          : execute()
      })
  }
}
