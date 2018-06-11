const encoder = require('../internal/encoder-selector.js')
module.exports = function () {
  global.logger.log(`Fully ready, serving ${global.bot.guilds.size} guild(s).`)
  if (!global.bot.bot) global.logger.warn("You're not using a bot account to run WildBeast, this is unsupported and could cause problems.")
  if (!process.env.WILDBEAST_DISABLE_MUSIC) encoder.init()
}
