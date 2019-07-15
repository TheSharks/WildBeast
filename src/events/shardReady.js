module.exports = (id) => {
  const client = require('../components/client')
  const { websocketDelay, guildCount } = require('../components/analytics')
  logger.debug(`CONNECT-${id}`, client.shards.get(id).discordServerTrace)
  setInterval(() => {
    websocketDelay.labels(id.toString()).set(client.shards.get(id).latency)
    guildCount.labels(id.toString()).set(client.guilds.size)
  }, process.env.METRICS_INTERVAL || 5000)
}
