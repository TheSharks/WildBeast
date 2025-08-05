import { container, LogLevel } from '@sapphire/framework'
import { Logger as SapphireLogger } from '@sapphire/plugin-logger'
import * as Sentry from '@sentry/node'
import type { LogLevel as AnalyticsLogLevel } from '../types.js'

export class AnalyticsLogger extends SapphireLogger {
  public override write(level: LogLevel, ...values: readonly unknown[]): void {
    // Map the log level to a Sentry level and add breadcrumb
    const sentryLevel = {
      [LogLevel.Trace]: 'debug',
      [LogLevel.Debug]: 'debug',
      [LogLevel.Info]: 'info',
      [LogLevel.Warn]: 'warning',
      [LogLevel.Error]: 'error',
      [LogLevel.Fatal]: 'fatal',
      [LogLevel.None]: 'info',
    }[level] as Sentry.SeverityLevel

    Sentry.addBreadcrumb({
      category: 'log',
      level: sentryLevel,
      message: values.join(' '),
    })

    // Call parent write method to maintain existing functionality
    super.write(level, ...values)

    // Send to analytics if available
    if (container.analytics && typeof container.analytics.log === 'function') {
      const analyticsLevel = this.mapSapphireLogLevelToAnalytics(level)
      const message = values.join(' ')

      try {
        container.analytics.log(analyticsLevel, message, {
          source: 'sapphire-logger',
          originalLevel: LogLevel[level],
        })
      } catch (error) {
        // Fail silently to avoid infinite logging loops
        console.error('Failed to send log to analytics:', error)
      }
    }
  }

  private mapSapphireLogLevelToAnalytics(level: LogLevel): AnalyticsLogLevel {
    switch (level) {
      case LogLevel.Trace:
      case LogLevel.Debug:
        return 'debug'
      case LogLevel.Info:
        return 'info'
      case LogLevel.Warn:
        return 'warn'
      case LogLevel.Error:
        return 'error'
      case LogLevel.Fatal:
        return 'fatal'
      case LogLevel.None:
      default:
        return 'info'
    }
  }
}

// Export everything from @sapphire/plugin-logger for compatibility
export * from '@sapphire/plugin-logger'
