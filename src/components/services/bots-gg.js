const SA = require('superagent')
const client = require('../client')

module.exports = {
  fn: async () => {
    logger.debug('SERVICE-BOTSGG', 'Updating stats')
    const res = await SA
      .post(`https://discord.bots.gg/api/v1/bots/${client.user.id}/stats`)
      .retry(3)
      .type('json')
      .send({
        guildCount: client.guilds.length,
        shardCount: client.options.maxShards,
        shardId: client.options.firstShardID
      })
      .set({
        Authorization: process.env.WILDBEAST_BOTS_GG_KEY,
        'User-Agent': `${client.user.username}-${client.user.discriminator}/${require('../../../package.json').verison} (Eris; +https://github.com/TheSharks/WildBeast) DBots/${client.user.id}`
      })
    logger.trace('SERVICE-BOTSGG', res)
  },
  interval: Math.floor(Math.random() * 1000) + 5000,
  // the interval is randomized since we cant anticipate when other shards might start posting stats
  // if all shards start posting stats at the same time, we get ratelimited and data gets lost
  runCheck: () => !!process.env.WILDBEAST_BOTS_GG_KEY
}
