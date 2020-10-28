/**
 * Represents the client
 * @type {module:eris.Client}
 */
const Eris = require('eris')
const { Collection } = require('eris')
module.exports = new Eris(process.env.BOT_TOKEN, {
  restMode: true,
  allowedMentions: {
    everyone: false
  },
  ...(process.env.WILDBEAST_SHARDS_MINE && process.env.WILDBEAST_SHARDS_TOTAL && !process.env.WILDBEAST_K8S_AUTOSCALE
    ? {
        maxShards: parseInt(process.env.WILDBEAST_SHARDS_TOTAL),
        firstShardID: parseInt(process.env.WILDBEAST_SHARDS_MINE),
        lastShardID: parseInt(process.env.WILDBEAST_SHARDS_MINE)
      }
    : {}),
  compress: true,
  guildSubscriptions: false,
  messageLimit: 10,
  intents: [
    'guilds',
    'guildMessages',
    'guildMessageReactions', // paginator
    'guildVoiceStates', // our voice join method needs this
    'directMessages', // we support dms
    'directMessageReactions' // paginator
  ]
})

module.exports.voiceConnectionManager = new Collection(require('../classes/VoiceConnection'))

// patch event emitter to allow for our custom event structure
module.exports._defaultEmit = module.exports.emit
module.exports.emit = function emit () {
  this._anyListeners.forEach(listener => listener.apply(this, [arguments]))
  return this._defaultEmit.apply(this, arguments)
}
module.exports.onAny = function onAny (func) {
  if (!this._anyListeners) this._anyListeners = []
  this._anyListeners.push(func)
}

module.exports.on('debug', x => logger.debug('ERIS', x))
module.exports.on('error', (e) => {
  // while the error event can be handled by our own structure like all other events
  // it wont be registered as a proper error handler, so the process can crash if we dont do it like this
  if (!(e instanceof Error)) logger.error('ERIS', e.error)
  else logger.error('ERIS', e)
})

module.exports.on('rawWS', () => {}) // forces eris to fire rawWS into onAny

const events = require('./events')
module.exports.onAny(ctx => {
  if (events.any) events.any.forEach(x => x(...ctx))
  if (events[ctx[0]]) events[ctx[0]].forEach(x => x(...(Array.from(ctx).slice(1))))
})
