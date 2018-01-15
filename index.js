require('dotenv').config()

const Eris = require('eris')
const Events = require('./src/internal/directory-loader')('./src/events')
const bot = new Eris(process.env['BOT_TOKEN'])
const db = require('./src/internal/database-selector')

bot._ogEmit = bot.emit
bot.emit = function emit () {
  this._anyListeners.forEach(listener => listener.apply(this, [arguments]))
  return this._ogEmit.apply(this, [arguments]) // eslint-disable-line
}
bot.onAny = function onAny (func) {
  if (!this._anyListeners) this._anyListeners = []
  this._anyListeners.push(func)
}

bot.onAny((ctx) => {
  if (Events[ctx[0]]) Events[ctx[0]](ctx) // FIXME: event handlers dont really need ctx[0] since thats the event name
})

bot.connect()
