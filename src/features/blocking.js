const driver = require('../selectors/database-selector')
module.exports = {
  blacklist: async (channel) => {
    let matches = channel.topic ? channel.topic.toLowerCase().match(/(?:\[([\w-]*)])/g) : []
    if (matches) matches = matches.map(x => x.replace('[', '').replace(']', '')) // FIXME
    return calculate(matches)
  },
  checkDynPerm: async (cmd, guild) => {
    if (!guild) return undefined
    const overrides = await driver.getOverrides(guild)
    return overrides[cmd]
  },
  changeDynPerm: async (cmd, guild, set) => {
    return driver.edit(guild.id, {
      overrides: {
        [cmd]: set
      }
    }, 'system')
  }
}

function calculate (matches) {
  const res = { allow: [], deny: [] }
  if (matches) {
    matches.forEach(x => {
      if (x.startsWith('-')) res.deny.push(x.slice(1))
      else res.allow.push(x)
    })
  }
  return res
}
