const chalk = require('chalk')
const log = console.log
const raven = require('raven')
const inspect = require('util').inspect

if (process.env.RAVEN_DSN) {
  raven.config(process.env.SENTRY_DSN, {
    parseUser: false
  }).install()
}

module.exports = {
  debug: (msg) => {
    if (process.env.NODE_ENV === 'debug') log(chalk`{bold.green DEBUG}: ${msg}`)
  },
  log: (msg) => {
    log(chalk`{bold.blue INFO}: ${msg}`) // nothing too interesting going on here
  },
  error: (e, exit = false) => {
    if (!(e instanceof Error)) { // in case strings get logged as errors, for whatever reason
      exit ? log(chalk`{bold.black.bgRed FATAL}: ${e}`) : log(chalk`{bold.red ERROR}: ${e}`)
      if (exit) process.exit(1)
    } else {
      if (raven.installed) raven.captureException(e)
      exit ? log(chalk`{bold.black.bgRed FATAL}: ${e.stack ? e.stack : e.message}`) : log(chalk`{bold.red ERROR}: ${e.stack ? e.stack : e.message}`)
      if (exit) process.exit(1)
    }
  },
  trace: (msg) => {
    if (process.env.NODE_ENV === 'debug') log(chalk`{bold.cyan TRACE}: ${inspect(msg)}`) // trace is the only logging route that inspects automatically
  },
  command: (opts) => { // specifically to log commands being ran
    if (process.env.WILDBEAST_SUPPRESS_COMMANDLOG) return
    log(chalk`{bold.yellow CMD}: ${opts.cmd} by ${opts.m.author.username} in ${opts.m.channel.guild ? opts.m.channel.guild.name : 'DM'}`)
    // TODO: send these logs to ES for analytics, if enabled
  }
}
