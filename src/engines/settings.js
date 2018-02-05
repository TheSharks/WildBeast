const driver = require('../internal/database-selector')

module.exports = {
  prefix: async (guild, msg) => {
    let tag = global.bot.user.mention
    if (msg.content.startsWith(tag)) return tag + ' '
    let settings = await driver.getSettings(guild)
    if (settings.prefix) return settings.prefix
    else {
      if (process.env['BOT_PREFIX']) return process.env['BOT_PREFIX']
      global.logger.error('No prefix defined! WildBeast will now exit...', true)
    }
  },
  modify: (guild, target, value) => {
    return driver.edit(guild.id, {
      settings: {
        [target]: value
      }
    })
  },
  modifyBulk: (guild, data) => {
    return driver.edit(guild.id, {
      settings: data
    })
  }
}
