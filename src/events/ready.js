module.exports = function (ctx) {
  global.logger.log(`All shards controlled by this process ready, serving ${global.bot.guilds.size} guild(s).`)
  if (!global.bot.bot) global.logger.warn("You're not using a bot account to run WildBeast, this is unsupported and could cause problems.")
  // we're addressing the bot object this way to avoid violating style unnecessarily
}
