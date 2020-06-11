const SA = require('superagent')
const client = require('../client')

module.exports = {
  fn: async () => {
    logger.debug('SERVICE-BOTSGG', 'Updating stats')
    await SA
      .post(`https://discord.bots.gg/api/v1/bots/${client.user.id}/stats`)
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
  },
  interval: 5000,
  runCheck: () => !!process.env.WILDBEAST_BOTS_GG_KEY
}
