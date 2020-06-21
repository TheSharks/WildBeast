const { LavalinkVoiceConnectionManager } = require('@thesharks/tyr')

module.exports = async () => {
  const client = require('../components/client')
  logger.log('BOOT', `Done starting up, logged in as ${client.user.username}#${client.user.discriminator} (${client.user.id}), shard range: ${client.options.firstShardID}-${client.options.lastShardID} max ${client.options.maxShards}`)

  require('../components/services')

  if (!(client.voiceConnections instanceof LavalinkVoiceConnectionManager)) {
    client.voiceConnections = new LavalinkVoiceConnectionManager([], { // we're instantiating without nodes intentionally!
      shards: client.options.maxShards,
      userId: client.user.id
    })

    if (process.env.LAVALINK_AUTODISCOVERY) {
      try {
        logger.log('LAVA', 'Autodiscovery enabled! Trying to discover nodes...')
        const ctx = JSON.parse(process.env.LAVALINK_AUTODISCOVERY)
        const dns = require('dns').promises

        const result = await dns.resolve4(ctx.hostname)
        logger.log('LAVA', `Got ${result.length} nodes from the DNS server, connecting to them now...`)

        client.voiceConnections.remapNodes(result.map(x => { return { host: x, ...ctx } }), {
          shards: client.options.maxShards,
          userId: client.user.id
        }, true)
      } catch (e) {
        logger.error('LAVA', e)
        logger.warn('LAVA', 'Falling back to LAVALINK_NODES')
        client.voiceConnections.remapNodes(JSON.parse(process.env.LAVALINK_NODES), {
          shards: client.options.maxShards,
          userId: client.user.id
        }, true)
      }
    } else {
      client.voiceConnections.remapNodes(JSON.parse(process.env.LAVALINK_NODES), {
        shards: client.options.maxShards,
        userId: client.user.id
      }, true)
    }
    client.voiceConnections.nodes.forEach(node => {
      node.on('ready', () => logger.log('LAVA', `Lavalink node ${node.address} is ready`))
      node.on('error', e => logger.error('LAVA', e))
      node.on('disconnected', () => logger.warn('LAVA', `Lavalink node ${node.address} disconnected`))
    })
  }
}
