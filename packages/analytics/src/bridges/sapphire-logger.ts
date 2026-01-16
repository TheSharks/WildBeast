import { logs, SeverityNumber } from '@opentelemetry/api-logs'
import { LogLevel } from '@sapphire/framework'
import { Logger as SapphireLogger } from '@sapphire/plugin-logger'
import * as Sentry from '@sentry/node'

export class AnalyticsLogger extends SapphireLogger {
  private readonly otelLogger = logs.getLogger('@thesharks/sapphire-logger')

  public override write(level: LogLevel, ...values: readonly unknown[]): void {
    const message = values.join(' ')

    // Call parent write method to maintain existing functionality (console output)
    super.write(level, ...values)

    // Send to OpenTelemetry
    try {
      this.otelLogger.emit({
        severityNumber: this.mapSapphireLogLevelToSeverity(level),
        severityText: LogLevel[level],
        body: message,
        attributes: {
          source: 'sapphire-logger',
          originalLevel: LogLevel[level],
        },
      })
    } catch (error) {
      // Fail silently to avoid infinite logging loops
      console.error('Failed to send log to OpenTelemetry:', error)
    }

    // Send to Sentry using the Logs API
    try {
      const sentryLogger = this.getSentryLogMethod(level)
      if (sentryLogger) {
        sentryLogger(message, {
          source: 'sapphire-logger',
          level: LogLevel[level],
        })
      }
    } catch (error) {
      // Fail silently to avoid infinite logging loops
      console.error('Failed to send log to Sentry:', error)
    }
  }

  private getSentryLogMethod(
    level: LogLevel,
  ): ((message: string, attributes?: Record<string, unknown>) => void) | null {
    switch (level) {
      case LogLevel.Trace:
        return Sentry.logger.trace
      case LogLevel.Debug:
        return Sentry.logger.debug
      case LogLevel.Info:
        return Sentry.logger.info
      case LogLevel.Warn:
        return Sentry.logger.warn
      case LogLevel.Error:
        return Sentry.logger.error
      case LogLevel.Fatal:
        return Sentry.logger.fatal
      case LogLevel.None:
      default:
        return null
    }
  }

  private mapSapphireLogLevelToSeverity(level: LogLevel): SeverityNumber {
    switch (level) {
      case LogLevel.Trace:
      case LogLevel.Debug:
        return SeverityNumber.DEBUG
      case LogLevel.Info:
        return SeverityNumber.INFO
      case LogLevel.Warn:
        return SeverityNumber.WARN
      case LogLevel.Error:
        return SeverityNumber.ERROR
      case LogLevel.Fatal:
        return SeverityNumber.FATAL
      case LogLevel.None:
      default:
        return SeverityNumber.INFO
    }
  }
}

// Export everything from @sapphire/plugin-logger for compatibility
export * from '@sapphire/plugin-logger'
