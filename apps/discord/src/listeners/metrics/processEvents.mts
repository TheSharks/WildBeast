import { ApplyOptions } from '@sapphire/decorators'
import type { ListenerOptions } from '@sapphire/framework'
import { Events, Listener } from '@sapphire/framework'
import { metrics, SpanStatusCode, trace } from '@thesharks/analytics'

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
    process.on('uncaughtException', (error) => {
      const span = trace.getActiveSpan()
      if (span) {
        span.recordException(error)
        span.setStatus({ code: SpanStatusCode.ERROR })
      }

      uncaughtExceptionCounter.add(1, {
        error_name: error.name,
        error_message: String(error.message).slice(0, 100),
      })

      this.container.logger?.error('Uncaught exception:', error)
    })

    process.on('unhandledRejection', (reason) => {
      const error = reason instanceof Error ? reason : new Error(String(reason))
      const span = trace.getActiveSpan()
      if (span) {
        span.recordException(error)
        span.setStatus({ code: SpanStatusCode.ERROR })
      }

      unhandledRejectionCounter.add(1, {
        error_name: error.name,
        error_message: String(error.message).slice(0, 100),
      })

      this.container.logger?.error('Unhandled rejection:', reason)
    })

    process.on('exit', (code) => {
      this.container.logger?.info(`Process exiting with code ${code}`)
    })
  }
}
