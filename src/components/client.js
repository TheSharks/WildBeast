const { ShardClient } = require('detritus-client')
const { GatewayIntents } = require('detritus-client-socket').Constants

/**
 * Represents the client
 * @type {ShardClient}
 */
module.exports = new ShardClient(process.env.BOT_TOKEN, {
  gateway: {
    ...(process.env.WILDBEAST_SHARDS_MINE && process.env.WILDBEAST_SHARDS_TOTAL && !process.env.WILDBEAST_K8S_AUTOSCALE
      ? {
          shardCount: parseInt(process.env.WILDBEAST_SHARDS_TOTAL),
          shardId: parseInt(process.env.WILDBEAST_SHARDS_MINE)
        }
      : {}),
    intents: [
      GatewayIntents.GUILD_VOICE_STATES,
      // GatewayIntents.GUILD_MESSAGES,
      GatewayIntents.GUILDS
    ],
    compress: true,
    autoReconnect: true,
    guildSubscriptions: false
  }
})

module.exports.voiceConnectionManager = new Map()

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

module.exports.on('debug', x => logger.debug('DETRITUS', x))
module.exports.on('error', (e) => {
  // while the error event can be handled by our own structure like all other events
  // it wont be registered as a proper error handler, so the process can crash if we dont do it like this
  if (!(e instanceof Error)) logger.error('DETRITUS', e.error)
  else logger.error('DETRITUS', e)
})

const events = require('./events')
module.exports.onAny(ctx => {
  if (events.any) events.any.forEach(x => x(...ctx))
  if (events[ctx[0]]) events[ctx[0]].forEach(x => x(...(Array.from(ctx).slice(1))))
})
