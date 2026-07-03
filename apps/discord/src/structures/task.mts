import { ScheduledTask } from '@sapphire/plugin-scheduled-tasks'
import * as Sentry from '@sentry/node'
import { spanName, withSpan } from '../utils/tracing.mjs'

/**
 * ScheduledTask base class that runs every task inside an active
 * OpenTelemetry span and an isolated Sentry scope. Subclasses implement
 * `run` exactly like a regular scheduled task; the constructor wraps it, so
 * database/HTTP spans created during the task nest under the task span.
 */
export abstract class TracedScheduledTask extends ScheduledTask {
  public constructor(
    context: ScheduledTask.LoaderContext,
    options: ScheduledTask.Options,
  ) {
    super(context, options)

    const run = this.run.bind(this)
    this.run = (payload) =>
      Sentry.withIsolationScope((scope) => {
        scope.setTag('task', this.name)
        return withSpan(
          spanName(`task.${this.name}`),
          {
            'discord.task.name': this.name,
            'sentry.op': 'discord.task',
          },
          () => run(payload),
        )
      })
  }
}
