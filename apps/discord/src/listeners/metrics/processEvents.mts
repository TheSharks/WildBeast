import { ApplyOptions } from '@sapphire/decorators'
import type { ListenerOptions } from '@sapphire/framework'
import { Events, Listener } from '@sapphire/framework'
import { metrics } from '@thesharks/analytics'

const meter = metrics.getMeter('@thesharks/discord')
// Labels frozen by METRIC_CONTRACT['process_uncaught_exception_total'] in
// packages/analytics/src/utils/metrics.ts.
const uncaughtExceptionCounter = meter.createCounter(
  'process_uncaught_exception_total',
  {
    description: 'Total number of uncaught exceptions',
  },
)
// Labels frozen by METRIC_CONTRACT['process_unhandled_rejection_total'] in
// packages/analytics/src/utils/metrics.ts.
const unhandledRejectionCounter = meter.createCounter(
  'process_unhandled_rejection_total',
  {
    description: 'Total number of unhandled promise rejections',
  },
)

@ApplyOptions<ListenerOptions>({
  event: Events.ClientReady,
  once: true,
})
export class ProcessErrorListener extends Listener {
  public run() {
    this.setupProcessHandlers()
  }

  private setupProcessHandlers() {
    // Monitor hook preserves crash semantics; Sentry handles capture/exit.
    process.on('uncaughtExceptionMonitor', (error, origin) => {
      uncaughtExceptionCounter.add(1, {
        origin,
        error_name: error instanceof Error ? error.name : 'unknown',
      })

      this.container.logger?.fatal(`${origin}:`, error)
    })

    process.on('unhandledRejection', (reason) => {
      const error = reason instanceof Error ? reason : new Error(String(reason))

      unhandledRejectionCounter.add(1, {
        error_name: error.name,
        // Keep original rejection kind as low-cardinality label.
        reason_type: reason instanceof Error ? 'error' : typeof reason,
      })

      this.container.logger?.error('Unhandled rejection:', reason)
    })
  }
}
