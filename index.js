require('dotenv').config()
global.logger = require('./src/internal/logger')
global.i18n = require('./src/internal/i18n')

require('./src/internal/secrets-loader')
require('./src/internal/check-env')

global.logger.log('Beginning startup sequence...')

require('./src/internal/version-check')

const Eris = require('eris')
const Events = require('./src/internal/directory-loader')('./src/events')
require('./src/internal/rancher-autoscale').then(x => {
  global.logger.log(`Scaling known. Total: ${x.total}, mine: ${x.mine}`)
  const bot = new Eris(process.env['BOT_TOKEN'], {
    restMode: true,
    maxShards: x.total,
    firstShardID: x.mine,
    lastShardID: x.mine
  })
  global.bot = bot

  if (x.hyperscale) {
    global.logger.log('Hyperscale enabled, reinstating previous state and trying to resume.')
    bot.shards.add(new Eris.Shard(x.mine, bot))
    bot.shards.get(x.mine).sessionID = x.hyperscale.state
    bot.shards.get(x.mine).seq = x.hyperscale.seq
  }

  bot._ogEmit = bot.emit
  bot.emit = function emit () {
    this._anyListeners.forEach(listener => listener.apply(this, [arguments]))
  return this._ogEmit.apply(this, arguments) // eslint-disable-line
  }
  bot.onAny = function onAny (func) {
    if (!this._anyListeners) this._anyListeners = []
    this._anyListeners.push(func)
  }

  bot.on('debug', global.logger.debug)

  bot.onAny((ctx) => {
    if (Events[ctx[0]]) {
      Events[ctx[0]](Array.from(ctx).slice(1))
    }
  })

  bot.connect().then(() => {
    require('./src/internal/bezerk')
  })
})

process.on('warn', global.logger.warn)

process.on('unhandledRejection', (err) => {
  global.logger.error(err)
})

process.on('uncaughtException', (err) => {
  // probably not the most stylish way to handle this, but it works
  global.logger.error(err, true) // we're exiting here, uncaughts are scary
})
