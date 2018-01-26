const driver = require('../internal/database-selector')

module.exports = {
  prefix: async (guild, msg) => {
    if (msg.content.startsWith(msg.channel.guild.shard.client.user.mention)) return msg.channel.guild.shard.client.user.mention + ' '
    let settings = await driver.getSettings(guild)
    if (settings.prefix) return settings.prefix
    else return process.env['BOT_PREFIX']
  }
}
