/**
 * Represents the client
 * @type {module:eris.Client}
 */
const Eris = require('eris')
const bot = new Eris(process.env.BOT_TOKEN)

// patch event emitter to allow for our custom event structure
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
  // while the error event can be handled by our own structure like all other events
  // it wont be registered as a proper error handler, so the process can crash if we dont do it like this
  if (!(e instanceof Error)) logger.error('ERIS', e.error)
  else logger.error('ERIS', e)
})

bot.on('rawWS', () => {}) // forces eris to fire rawWS into onAny

const events = require('./events')
bot.onAny(ctx => {
  if (events.any) events.any.forEach(x => x(...ctx))
  if (events[ctx[0]]) events[ctx[0]].forEach(x => x(...(Array.from(ctx).slice(1))))
})

module.exports = bot
