module.exports = function (ctx) {
  global.logger.log(`All shards controlled by this process ready, serving ${global.bot.guilds.size} guild(s).`)
  // we're addressing the bot object this way to avoid violating style unnecessarily
}
