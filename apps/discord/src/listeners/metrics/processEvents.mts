import { ApplyOptions } from '@sapphire/decorators'
import type { ListenerOptions } from '@sapphire/framework'
import { Events, Listener } from '@sapphire/framework'
import { metrics } from '@thesharks/analytics'

const meter = metrics.getMeter('@thesharks/discord')
const uncaughtExceptionCounter = meter.createCounter(
  'process_uncaught_exception_total',
  {
    description: 'Total number of uncaught exceptions',
  },
)
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
    // The monitor hook observes crashes without changing Node's crash
    // semantics (a plain uncaughtException handler would keep the process
    // alive in an undefined state). Sentry's own integrations handle the
    // exception capture and process exit.
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
      })

      this.container.logger?.error('Unhandled rejection:', reason)
    })
  }
}
