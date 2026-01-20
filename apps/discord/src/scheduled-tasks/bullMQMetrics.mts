import { ScheduledTask } from '@sapphire/plugin-scheduled-tasks'
import { type Attributes, createGauge } from '@thesharks/analytics'
import { Queue } from 'bullmq'

const queueSizeGauge = createGauge(
  '@thesharks/discord',
  'bullmq_queue_size',
  'Number of jobs in BullMQ queue',
)
const queueActiveGauge = createGauge(
  '@thesharks/discord',
  'bullmq_queue_active',
  'Number of jobs currently being processed in BullMQ queue',
)
const queueWaitingGauge = createGauge(
  '@thesharks/discord',
  'bullmq_queue_waiting',
  'Number of jobs waiting in BullMQ queue',
)
const queueDelayedGauge = createGauge(
  '@thesharks/discord',
  'bullmq_queue_delayed',
  'Number of delayed jobs in BullMQ queue',
)
const queueFailedGauge = createGauge(
  '@thesharks/discord',
  'bullmq_queue_failed',
  'Number of failed jobs in BullMQ queue',
)
const queueCompletedGauge = createGauge(
  '@thesharks/discord',
  'bullmq_queue_completed',
  'Number of completed jobs in BullMQ queue',
)

export class BullMQMetricsTask extends ScheduledTask {
  private queues: Map<string, Queue> = new Map()

  public constructor(
    context: ScheduledTask.LoaderContext,
    options: ScheduledTask.Options,
  ) {
    super(context, {
      ...options,
      interval: 60_000,
    })
  }

  public async run() {
    try {
      await this.updateBullMQMetrics()
    } catch (error) {
      this.container.logger?.warn('BullMQ metrics collection failed', error)
    }
  }

  private async updateBullMQMetrics() {
    const config = {
      host: process.env.REDIS_HOST ?? 'localhost',
      port: (() => {
        if (!process.env.REDIS_PORT) return 6379
        const port = Number.parseInt(process.env.REDIS_PORT, 10)
        return Number.isFinite(port) ? port : 6379
      })(),
      password: process.env.REDIS_PASSWORD,
      db: process.env.REDIS_DB
        ? Number.parseInt(process.env.REDIS_DB, 10)
        : undefined,
    }

    const queueNames = ['metricsCollection']

    for (const queueName of queueNames) {
      try {
        if (!this.queues.has(queueName)) {
          const queue = new Queue(queueName, {
            connection: config,
          })
          this.queues.set(queueName, queue)
        }

        const queue = this.queues.get(queueName)!
        const counts = await queue.getJobCounts()
        const labels: Attributes = {
          queue_name: queueName,
        }

        queueSizeGauge.set(
          (counts.waiting ?? 0) + (counts.active ?? 0) + (counts.delayed ?? 0),
          labels,
        )
        queueActiveGauge.set(counts.active ?? 0, labels)
        queueWaitingGauge.set(counts.waiting ?? 0, labels)
        queueDelayedGauge.set(counts.delayed ?? 0, labels)
        queueFailedGauge.set(counts.failed ?? 0, labels)
        queueCompletedGauge.set(counts.completed ?? 0, labels)
      } catch (error) {
        this.container.logger?.warn(
          `Failed to get metrics for queue ${queueName}`,
          error,
        )
      }
    }
  }
}

declare module '@sapphire/plugin-scheduled-tasks' {
  interface ScheduledTasks {
    bullMQMetrics: never
  }
}
