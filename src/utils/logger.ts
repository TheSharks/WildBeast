import chalk from 'chalk'
import { format } from 'date-fns'
import { nl } from 'date-fns/locale' // 24h formatting, this is easier
import { inspect } from 'util'
import * as Sentry from '@sentry/node'
import { CaptureContext } from '@sentry/types'

const log = (type: string, ctx: string, msg: any): void => {
  console.log(chalk`{gray ${format(new Date(), 'pp', { locale: nl })}} [${type}] ${ctx}: ${msg}`)
}

/**
 * Log a debug message
 *
 * Events sent to this will only be logged to the console if NODE_ENV is set to `debug`,
 * however events will be added as breadcrumbs for Sentry regardless of the NODE_ENV
 * @param message The message you want to log
 * @param component The component this message originates from
 */
export function debug (message: any, component: string = 'generic'): void {
  Sentry.addBreadcrumb({
    category: component,
    message,
    level: Sentry.Severity.Debug
  })
  if (process.env.NODE_ENV === 'debug') log(chalk`{blue dbug}`, chalk`{blue ${component}}`, message)
}

/**
 * Log something to the console
 * @param message The message
 * @param component The component this message originates from
 */
export function info (message: any, component: string = 'generic'): void {
  Sentry.addBreadcrumb({
    category: component,
    message,
    level: Sentry.Severity.Info
  })
  log(chalk`{green info}`, chalk`{green ${component}}`, message)
}

/**
 * Log an error
 *
 * Errors get sent to Sentry (when available) and to the console
 * @param _err The error
 * @param component The component this message originates from
 * @param captureContext Optional, extra context data to send to Sentry
 * @returns The corresponding Sentry UID
 */
export function error (_err: any, component: string = 'generic', captureContext?: CaptureContext): string {
  let uuid
  if (!(_err instanceof Error)) {
    uuid = Sentry.captureMessage(_err, {
      level: Sentry.Severity.Error,
      ...captureContext
    })
  } else {
    uuid = Sentry.captureException(_err, {
      level: Sentry.Severity.Error,
      ...captureContext
    })
  }
  log(chalk`{red erro}`, chalk`{red ${component}}`, _err instanceof Error ? _err.stack : _err)
  return uuid
}

/**
 * Log a fatal error
 *
 * Errors get sent to Sentry (when available) and to the console,
 * calling this method **will** end the process when Sentry has finished processing
 * @param _err The error
 * @param component The component this message originates from
 * @param captureContext Optional, extra context data to send to Sentry
 */
export function fatal (_err: any, component: string = 'generic', captureContext?: CaptureContext): void {
  if (!(_err instanceof Error)) {
    Sentry.captureMessage(_err, {
      level: Sentry.Severity.Fatal,
      ...captureContext
    })
  } else {
    Sentry.captureException(_err, {
      level: Sentry.Severity.Fatal,
      ...captureContext
    })
  }
  log(chalk`{bgRed fatl}`, chalk`{bgRed ${component}}`, _err instanceof Error ? _err.stack : _err)
  Sentry.close(10000).then(() => process.exit(1)).catch(() => process.exit(1))
}

/**
 * Warn the console about something
 *
 * Messages sent here get added as breadcrumbs to Sentry
 * @param message The message
 * @param component The component this message originates from
 */
export function warn (message: any, component: string = 'generic'): void {
  Sentry.addBreadcrumb({
    category: component,
    message,
    level: Sentry.Severity.Warning
  })
  log(chalk`{yellow warn}`, chalk`{yellow ${component}}`, message)
}

/**
 * Trace something to the console
 *
 * Messages passed to this function get passed though util.inspect
 * @param message The message
 * @param component The component this message originates from
 */
export function trace (message: any, component: string = 'generic'): void {
  Sentry.addBreadcrumb({
    category: component,
    message,
    level: Sentry.Severity.Debug
  })
  if (process.env.NODE_ENV === 'debug') log(chalk`{cyan trce}`, chalk`{cyan ${component}}`, inspect(message, { colors: true, depth: null }))
}
