import { inspect } from 'node:util'
import { logs, SeverityNumber } from '@opentelemetry/api-logs'
import { LogLevel } from '@sapphire/framework'
import { Logger as SapphireLogger } from '@sapphire/plugin-logger'
import * as Sentry from '@sentry/node'

/** Keys that must never leave the process in telemetry. */
// Keep in sync with SENTRY_PII_DENYLIST in telemetry.ts; drift leaks PII one way.
export const LOGGER_PII_DENYLIST = [
  'token',
  'authorization',
  'password',
  'secret',
  'email',
  'username',
  'tag',
  'globalName',
  'displayName',
  'guild_name',
  'channel_name',
] as const

function isDeniedLoggerKey(key: string): boolean {
  const lower = key.toLowerCase()
  return (LOGGER_PII_DENYLIST as readonly string[]).some(
    (denied) => lower === denied || lower.endsWith(`_${denied}`),
  )
}

function redactLoggerValue(value: unknown, key?: string): unknown {
  if (key && isDeniedLoggerKey(key)) {
    return '[Redacted]'
  }
  if (Array.isArray(value)) {
    return value.map((entry) => redactLoggerValue(entry))
  }
  // Why: rebuilding from enumerable entries drops message/stack/cause, so Errors pass through for inspect.
  if (value instanceof Error) {
    return value
  }
  // Why: Dates/Maps/Sets have no enumerable payload, so normalize before inspect to keep contents visible.
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? 'Invalid Date' : value.toISOString()
  }
  if (value instanceof Map) {
    return Array.from(value.entries(), ([k, v]) => [
      k,
      redactLoggerValue(v, typeof k === 'string' ? k : undefined),
    ])
  }
  if (value instanceof Set) {
    return Array.from(value, (entry) => redactLoggerValue(entry))
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = redactLoggerValue(v, k)
    }
    return out
  }
  return value
}

function scrubLoggerText(text: string): string {
  return text
    .replace(
      /[A-Za-z0-9_-]{24}\.[A-Za-z0-9_-]{6}\.[A-Za-z0-9_-]{27}/g,
      '[Redacted]',
    )
    .replace(/Bearer\s+[A-Za-z0-9._~-]+/gi, 'Bearer [Redacted]')
}

export class AnalyticsLogger extends SapphireLogger {
  private readonly otelLogger = logs.getLogger('@thesharks/sapphire-logger')

  public override write(level: LogLevel, ...values: readonly unknown[]): void {
    super.write(level, ...values)

    // Respect level for telemetry to avoid flooding OTEL/Sentry.
    if (level < this.level) {
      return
    }

    const message = values
      .map((value) =>
        typeof value === 'string'
          ? scrubLoggerText(value)
          : scrubLoggerText(
              inspect(redactLoggerValue(value), { colors: false, depth: 3 }),
            ),
      )
      .join(' ')

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
