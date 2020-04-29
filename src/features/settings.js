const driver = require('../selectors/database-selector')

module.exports = {
  prefix: async (guild, msg) => {
    const tag = new RegExp(`<@!?${global.bot.user.id}>`)
    if (msg.content.search(tag) === 0) return tag.exec(msg.content) + ' '
    const settings = await driver.getSettings(guild)
    if (settings.prefix) return settings.prefix
    else {
      if (process.env.BOT_PREFIX) return process.env.BOT_PREFIX
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
