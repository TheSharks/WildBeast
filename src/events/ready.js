const { LavalinkVoiceConnectionManager } = require('@thesharks/tyr')

module.exports = () => {
  const client = require('../components/client')
  logger.log('BOOT', `Done starting up, logged in as ${client.user.username}#${client.user.discriminator} (${client.user.id})`)

  client.voiceConnections = new LavalinkVoiceConnectionManager(JSON.parse(process.env.LAVALINK_NODES), {
    shards: client.options.maxShards,
    userId: client.user.id
  })
  client.voiceConnections.nodes.forEach(node => {
    node.on('ready', () => logger.log('LAVA', `Lavalink node ${node.address} is ready`))
    node.on('error', e => logger.error('LAVA', e))
    node.on('disconnected', () => logger.warn('LAVA', `Lavalink node ${node.address} disconnected`))
  })
}
