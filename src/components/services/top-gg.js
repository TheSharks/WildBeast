const SA = require('superagent')
const client = require('../client')

module.exports = {
  fn: async () => {
    logger.debug('SERVICE-TOPGG', 'Updating stats')
    await SA
      .post(`https://top.gg/api/bots/${client.user.id}/stats`)
      .type('json')
      .send({
        server_count: client.guilds.length,
        shard_count: client.options.maxShards,
        shard_id: client.options.firstShardID
      })
      .set({
        Authorization: process.env.WILDBEAST_TOP_GG_KEY,
        'User-Agent': `${client.user.username}-${client.user.discriminator}/${require('../../../package.json').verison} (+https://github.com/TheSharks/WildBeast`
      })
  },
  interval: 5000,
  runCheck: () => !!process.env.WILDBEAST_TOP_GG_KEY
}
