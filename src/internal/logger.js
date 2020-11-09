const chalk = require('chalk')
const Sentry = require('../components/sentry')

const log = (v) => {
  const { format } = require('date-fns')
  console.log(chalk`{gray [${format(new Date(), 'Pp')}]} - ${v}`)
}
const inspect = require('util').inspect

module.exports = {
  /**
   * Debug log something
   * These log messages only get shown if NODE_ENV is set to debug
   * @param {String} type - Type of the message to log
   * @param {*} msg - The data to log
   */
  debug: (type, msg) => {
    Sentry.addBreadcrumb({
      category: 'console',
      level: Sentry.Severity.Debug,
      message: msg
    })
    if (process.env.NODE_ENV === 'debug') log(chalk`[{bold.green ${`DEBUG:${type}`.padStart(20)}}] - ${msg}`)
  },
  /**
   * Log something
   * @param {String} type - Type of the message to log
   * @param {*} msg - The data to log
   */
  log: (type, msg) => {
    Sentry.addBreadcrumb({
      category: 'console',
      level: Sentry.Severity.Info,
      message: msg
    })
    log(chalk`[{bold.blue ${`INFO:${type}`.padStart(20)}}] - ${msg}`) // nothing too interesting going on here
  },
  /**
   * Log an error
   * Errors logged this way can be sent to Sentry
   * @param {String} type - Type of the message to log
   * @param {Error | String} e - The error to log
   * @param {Boolean} [exit=false] - Whether or not to exit the program after processing of this error is done
   * @returns {String} The corresponding Sentry UID
   */
  error: (type, e, exit = false) => {
    Sentry.addBreadcrumb({
      category: 'console',
      level: Sentry.Severity.Error,
      message: (e instanceof Error) ? e.message : e
    })
    if (!(e instanceof Error)) { // in case strings get logged as errors, for whatever reason
      exit ? log(chalk`[{bold.black.bgRed ${`FATAL:${type}`.padStart(20)}}] - ${e}`) : log(chalk`[{bold.red ${`ERROR:${type}`.padStart(20)}}] - ${e}`)
      if (exit) process.exit(1)
      return Sentry.captureMessage(e)
    } else {
      exit ? log(chalk`[{bold.black.bgRed ${`FATAL:${type}`.padStart(20)}}] - ${e.stack ? e.stack : e.message}`) : log(chalk`[{bold.red ${`ERROR:${type}`.padStart(20)}}] - ${e.stack ? e.stack : e.message}`)
      if (exit) process.exit(1)
      return Sentry.captureException(e)
    }
  },
  /**
   * Warn the console about something
   * @param {String} type - Type of the message to log
   * @param {*} msg - The data to log
   */
  warn: (type, msg) => {
    Sentry.addBreadcrumb({
      category: 'console',
      level: Sentry.Severity.Warning,
      message: msg
    })
    log(chalk`[{bold.yellow ${`WARN:${type}`.padStart(20)}}] - ${msg}`)
  },
  /**
   * Trace something
   * These messages only get shown if NODE_ENV is set to debug
   * The msg param gets passed through util.inspect
   * @param {String} type - Type of the message to log
   * @param {*} msg - The data to log
   */
  trace: (type, msg) => {
    Sentry.addBreadcrumb({
      category: 'console',
      level: Sentry.Severity.Debug,
      message: msg
    })
    if (process.env.NODE_ENV === 'debug') log(chalk`[{bold.cyan ${`TRACE:${type}`.padStart(20)}}] - ${inspect(msg)}`) // trace is the only logging route that inspects automatically
  },
  /**
   * Log a command that's being ran
   * @param {Object} opts - Object with data concerning the command
   */
  command: (opts) => { // specifically to log commands being ran
    Sentry.addBreadcrumb({
      category: 'command',
      level: Sentry.Severity.Info,
      message: `${opts.cmd} by ${opts.m.author.username} in ${opts.m.channel.guild ? opts.m.channel.guild.name : 'DM'}`
    })
    if (process.env.WILDBEAST_SUPPRESS_COMMANDLOG) return
    log(chalk`[{bold.magenta ${'CMD'.padStart(20)}}] - ${opts.cmd} by ${opts.m.author.username} in ${opts.m.channel.guild ? opts.m.channel.guild.name : 'DM'}`)
  }
}
