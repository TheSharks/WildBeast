require('dotenv').config()

const Eris = require('eris')
const Logger = require('./src/internal/logger')
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
    Logger.debug(`Found listener for event '${ctx[0]}'`)
    Events[ctx[0]](Array.from(ctx).slice(1))
  } // else Logger.debug(`No listener for '${ctx[0]}' found`)
})

bot.on('debug', Logger.debug)

bot.connect()
