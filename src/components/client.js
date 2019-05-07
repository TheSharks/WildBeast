/**
 * Represents the client
 * @type {module:eris.Client}
 */
const Eris = require('eris')
const bot = new Eris(process.env.BOT_TOKEN)

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

const events = require('./events')
bot.onAny(ctx => {
  if (events[ctx[0]]) events[ctx[0]].forEach(x => x(Array.from(ctx).slice(1)))
})

module.exports = bot
