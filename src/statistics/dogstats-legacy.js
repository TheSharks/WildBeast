const StatsD = require('hot-shots')
const client = new StatsD({
  host: process.env.HOTSHOTS_HOST,
  prefix: process.env.HOTSHOTS_PREFIX || 'wildbeast.',
  errorHandler: global.logger.error
})

module.exports = {
  eventHook: (eventname) => {
    client.increment('events.all', {
      eventType: eventname
    })
  },
  statsHook: (bot) => {
    client.gauge('users.count', bot.users.size, {
      shardID: bot.options.firstShardID
    })
    client.gauge('guilds.count', bot.guilds.size, {
      shardID: bot.options.firstShardID
    })
  }
}
