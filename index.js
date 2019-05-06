require('dotenv').config()
global.logger = require('./src/internal/logger')
global.i18n = require('./src/internal/i18n')
global.chalk = require('chalk')
require('./src/internal/check-env')

logger.log('BOOT', 'Beginning startup sequence...')

require('./src/internal/version-check')

const Eris = require('eris')
global.bot = new Eris(process.env.BOT_TOKEN)

bot._ogEmit = bot.emit
bot.emit = function emit () {
  this._anyListeners.forEach(listener => listener.apply(this, [arguments]))
  return this._ogEmit.apply(this, arguments)
}
bot.onAny = function onAny (func) {
  if (!this._anyListeners) this._anyListeners = []
  this._anyListeners.push(func)
}

bot.on('debug', x => logger.debug('ERIS', x))
bot.on('error', (e) => {
  if (!(e instanceof Error)) global.logger.error('ERIS', e.error)
  else global.logger.error('ERIS', e)
})

const events = require('./src/components/events')
bot.onAny(ctx => {
  if (events[ctx[0]]) events[ctx[0]].forEach(x => x(Array.from(ctx).slice(1)))
})

process.on('warn', logger.warn)

process.on('unhandledRejection', (err) => {
  logger.error(err)
})

process.on('uncaughtException', (err) => {
  // probably not the most stylish way to handle this, but it works
  logger.error(err, true) // we're exiting here, uncaughts are scary
})

bot.connect()
