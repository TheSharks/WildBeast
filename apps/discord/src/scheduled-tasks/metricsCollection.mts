import type { ScheduledTask } from '@sapphire/plugin-scheduled-tasks'
import { AppScheduledTask } from '../structures/task.mjs'
import { collectRuntimeMetrics } from '../telemetry/runtime-metrics.mjs'

export class MetricsCollectionTask extends AppScheduledTask {
  public constructor(
    context: ScheduledTask.LoaderContext,
    options: ScheduledTask.Options,
  ) {
    super(context, { ...options, interval: 60_000 })
  }

  public run() {
    collectRuntimeMetrics(this.container.client)
  }
}

declare module '@sapphire/plugin-scheduled-tasks' {
  interface ScheduledTasks {
    metricsCollection: never
  }
}
