const statsRunning = []

module.exports = (id) => {
  const client = require('../components/client')
  const { websocketDelay, guildCount, uniqueUsers, users, activeEncoders } = require('../components/analytics')
  logger.debug(`CONNECT-${id}`, client.shards.get(id).discordServerTrace)
  if (!statsRunning.includes(id)) {
    statsRunning.push(id)
    setInterval(() => {
      websocketDelay.labels(id.toString()).set(client.shards.get(id).latency)
      guildCount.labels(id.toString()).set(client.guilds.size)
      uniqueUsers.set(client.users.size)
      users.set(client.guilds.map(x => x.memberCount).reduce((a, b) => a + b, 0))
      activeEncoders.set(client.voiceConnections.size)
    }, process.env.METRICS_INTERVAL || 5000)
  }
}
