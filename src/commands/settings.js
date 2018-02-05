const engine = require('../engines/settings')
const driver = require('../internal/database-selector')
const whitelist = [
  'prefix',
  'language'
]

module.exports = {
  meta: {
    help: 'View/change settings about your server.',
    alias: [],
    noDM: true,
    level: 5
  },
  fn: async (msg, suffix) => {
    if (suffix) {
      const parts = suffix.split(' ')
      if (!whitelist.includes(parts[0])) return global.i18n.send('SETTINGS_NOT_WHITELISTED', msg.channel)
      const current = await driver.getSettings(msg.channel.guild)
      if (!parts[1]) {
        global.i18n.send('SETTINGS_SINGLE_REPLY', msg.channel, {
          setting: parts[0],
          value: current[parts[0]]
        })
      } else {
        await engine.modify(msg.channel.guild, parts[0], parts[1])
        return global.i18n.send('SETTINGS_MODIFIED', msg.channel, {
          setting: parts[0],
          value: parts[1]
        })
      }
    } else {
      // send current settings
      const settings = await driver.getSettings(msg.channel.guild)
      if (Object.keys(settings).length === 0) return global.i18n.send('SETTINGS_NO_DATA', msg.channel)
      let result = [
        global.i18n.raw('SETTINGS_ALL_INTRO'),
        ''
      ]
      for (let x in settings) {
        result.push(`${x}: \`${settings[x]}\``)
      }
      msg.channel.createMessage(result.join('\n'))
    }
  }
}
