const SA = require('superagent')
const client = require('../client')

module.exports = {
  fn: async () => {
    logger.debug('SERVICE-TOPGG', 'Updating stats')
    const res = await SA
      .post(`https://top.gg/api/bots/${client.user.id}/stats`)
      .retry(3)
      .type('json')
      .send({
        server_count: client.guilds.length,
        shard_count: client.options.maxShards,
        shard_id: client.options.firstShardID
      })
      .set({
        Authorization: process.env.WILDBEAST_TOP_GG_KEY,
        'User-Agent': `${client.user.username}-${client.user.discriminator}/${require('../../../package.json').verison} (+https://github.com/TheSharks/WildBeast)`
      })
    logger.trace('SERVICE-TOPGG', res)
  },
  interval: Math.floor(Math.random() * 1000) + 5000,
  // the interval is randomized since we cant anticipate when other shards might start posting stats
  // if all shards start posting stats at the same time, we get ratelimited and data gets lost
  runCheck: () => !!process.env.WILDBEAST_TOP_GG_KEY
}
