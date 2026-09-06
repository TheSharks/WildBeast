import type { ScheduledTask } from '@sapphire/plugin-scheduled-tasks'
import { AppScheduledTask } from '../structures/task.mjs'

/** Keeps operator commands placed in exactly the configured guilds. */
export class OperatorCommandReconcileTask extends AppScheduledTask {
  public constructor(
    context: ScheduledTask.LoaderContext,
    options: ScheduledTask.Options,
  ) {
    super(context, { ...options, interval: 60 * 60 * 1000, requiresShard: 0 })
  }

  public async run() {
    const app = this.container.app
    const result = await app.operatorCommands.reconcile(app.work.signal)
    const level = result.failures.length > 0 ? 'warn' : 'info'
    this.container.logger[level](
      `Operator commands placed in ${result.guilds} guild(s): ${result.created} created, ${result.updated} updated, ${result.removed} removed, ${result.failures.length} failed`,
      ...result.failures.map(
        (failure) =>
          `${failure.name}@${failure.guildId}: ${String(failure.error)}`,
      ),
    )
  }
}

declare module '@sapphire/plugin-scheduled-tasks' {
  interface ScheduledTasks {
    operatorCommandReconcile: never
  }
}
