require('dotenv').config()

global.logger = require('./src/internal/logger')
global.logger.log('Beginning startup sequence...')

const Eris = require('eris')
const Events = require('./src/internal/directory-loader')('./src/events')
const bot = new Eris(process.env['BOT_TOKEN'])

bot._ogEmit = bot.emit
bot.emit = function emit () {
  this._anyListeners.forEach(listener => listener.apply(this, [arguments]))
  return this._ogEmit.apply(this, arguments) // eslint-disable-line
}
bot.onAny = function onAny (func) {
  if (!this._anyListeners) this._anyListeners = []
  this._anyListeners.push(func)
}

bot.onAny((ctx) => {
  if (Events[ctx[0]]) {
    // global.logger.debug(`Found listener for event '${ctx[0]}'`)
    Events[ctx[0]](Array.from(ctx).slice(1))
  } // else Logger.debug(`No listener for '${ctx[0]}' found`)
})

process.on('unhandledRejection', (err) => {
  global.logger.error(err)
})

process.on('uncaughtException', (err) => {
  // probably not the most stylish way to handle this, but it works
  global.logger.error(err, true) // we're exiting here, uncaughts are scary
})

bot.connect().then(() => {
  global.bot = bot
  if (!bot.bot) global.logger.warn("You're not using a bot account to run WildBeast, this is unsupported and could cause problems.")
})
