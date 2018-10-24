const encoder = require('../selectors/encoder-selector.js')
module.exports = async function () {
  global.logger.log(`Fully ready, serving ${global.bot.guilds.size} guild(s).`)
  if (!global.bot.bot) global.logger.warn("You're not using a bot account to run WildBeast, this is unsupported and could cause problems.")
  if (global.bot.guilds.size === 0) {
    const app = await global.bot.getOAuthApplication()
    global.logger.log('Detected a fresh bot account')
    global.logger.log(`Please open the following link in your browser to invite the bot to your server:`)
    global.logger.log(`https://discordapp.com/oauth2/authorize?&client_id=${app.id}&scope=bot`)
  }
  if (!process.env.WILDBEAST_DISABLE_MUSIC) encoder.init()
}
