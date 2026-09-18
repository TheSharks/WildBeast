import type { ScheduledTask } from '@sapphire/plugin-scheduled-tasks'
import type { Attributes } from '@thesharks/analytics'
import { AppScheduledTask } from '../structures/task.mjs'
import { gauge } from '../telemetry/meter.mjs'

const queueSizeGauge = gauge(
  'bullmq_queue_size',
  'Number of jobs in BullMQ queue',
)
const queueActiveGauge = gauge(
  'bullmq_queue_active',
  'Number of jobs currently being processed in BullMQ queue',
)
const queueWaitingGauge = gauge(
  'bullmq_queue_waiting',
  'Number of jobs waiting in BullMQ queue',
)
const queueDelayedGauge = gauge(
  'bullmq_queue_delayed',
  'Number of delayed jobs in BullMQ queue',
)
const queueFailedGauge = gauge(
  'bullmq_queue_failed',
  'Number of failed jobs in BullMQ queue',
)
const queueCompletedGauge = gauge(
  'bullmq_queue_completed',
  'Number of completed jobs in BullMQ queue',
)

export class BullMQMetricsTask extends AppScheduledTask {
  public constructor(
    context: ScheduledTask.LoaderContext,
    options: ScheduledTask.Options,
  ) {
    super(context, { ...options, interval: 60_000 })
  }

  protected override async execute() {
    // Every task shares the plugin's queue; reuse its connection.
    const { client: queue, queue: queueName } = this.container.tasks
    const counts = await queue.getJobCounts()
    const labels: Attributes = { queue_name: queueName }
    queueSizeGauge.set(
      (counts.waiting ?? 0) + (counts.active ?? 0) + (counts.delayed ?? 0),
      labels,
    )
    queueActiveGauge.set(counts.active ?? 0, labels)
    queueWaitingGauge.set(counts.waiting ?? 0, labels)
    queueDelayedGauge.set(counts.delayed ?? 0, labels)
    queueFailedGauge.set(counts.failed ?? 0, labels)
    queueCompletedGauge.set(counts.completed ?? 0, labels)
  }
}

declare module '@sapphire/plugin-scheduled-tasks' {
  interface ScheduledTasks {
    bullMQMetrics: never
  }
}
