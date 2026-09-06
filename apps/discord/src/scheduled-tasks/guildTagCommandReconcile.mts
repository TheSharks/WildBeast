import type { ScheduledTask } from '@sapphire/plugin-scheduled-tasks'
import { AppScheduledTask } from '../structures/task.mjs'
import { recordRepair } from '../telemetry/tag-metrics.mjs'

/** Nightly repair of promoted tag commands; app-global, so shard 0's worker runs it. */
export class GuildTagCommandReconcileTask extends AppScheduledTask {
  public constructor(
    context: ScheduledTask.LoaderContext,
    options: ScheduledTask.Options,
  ) {
    super(context, { ...options, pattern: '0 4 * * *', requiresShard: 0 })
  }

  public async run() {
    const app = this.container.app
    const results = await app.tagReconciler.reconcileAll(
      app.work.signal,
      app.config.devGuildId ?? undefined,
    )
    let failed = 0
    for (const result of results.values()) {
      if (result instanceof Error || result.failures.length > 0) failed += 1
      if (!(result instanceof Error)) recordRepair(result, 'reconcile')
    }
    this.container.logger.info(
      `Repaired promoted tag commands in ${results.size} guild(s); ${failed} with failures`,
    )
  }
}

declare module '@sapphire/plugin-scheduled-tasks' {
  interface ScheduledTasks {
    guildTagCommandReconcile: never
  }
}
