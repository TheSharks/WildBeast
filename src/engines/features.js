const driver = require('../internal/database-selector')

module.exports = {
  raw: (guild) => {
    return driver.getFlags(guild)
  },
  has: async (flag, guild) => {
    const flags = await module.exports.raw(guild)
    return flags.includes(flag)
  }
}
