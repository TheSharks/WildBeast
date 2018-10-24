const engine = require('../features/settings')
const driver = require('../selectors/database-selector')
const whitelist = [
  'prefix',
  'language',
  'welcome',
  'welcomemessage'
]

module.exports = {
  meta: {
    help: 'Base command for settings. Returns current settings if no setting is specified.',
    usage: '<setting> <parameter>',
    module: 'Settings',
    level: 5,
    noDM: true,
    alias: ['config'],
    addons: [
      `**Available settings**: ${whitelist.join(', ')}`
    ]
  },
  fn: async (msg, suffix) => {
    if (suffix) {
      const parts = suffix.split(' ')
      parts[0] = parts[0].toLowerCase()
      if (!whitelist.includes(parts[0]) && parts[0] !== 'reset') return global.i18n.send('SETTINGS_NOT_WHITELISTED', msg.channel)
      const current = await driver.getSettings(msg.channel.guild)
      if (!parts[1]) {
        if (current[parts[0]] === undefined) {
          global.i18n.send('SETTINGS_SINGLE_NOT_SET', msg.channel, {
            setting: parts[0]
          })
        } else {
          global.i18n.send('SETTINGS_SINGLE_REPLY', msg.channel, {
            setting: parts[0],
            value: current[parts[0]]
          })
        }
      } else {
        if (parts[0] === 'reset') {
          if (whitelist.includes(parts[1]) && parts[1] !== 'reset') {
            await engine.modify(msg.channel.guild, parts[1], null)
            return global.i18n.send('SETTINGS_RESET', msg.channel, {
              setting: parts[1]
            })
          } else return global.i18n.send('SETTINGS_NOT_WHITELISTED', msg.channel)
        }
        if (parts[0] === 'welcome') {
          const match = /<#([0-9]*)>/g.exec(parts[1])
          if (parts[1].toLowerCase() !== 'dm' && !match) return global.i18n.send('SETTINGS_WELCOMING_MALFORMED', msg.channel)
          if (match) parts[1] = match[1]
          else parts[1] = parts[1].toLowerCase()
        }
        if (parts[0] === 'language') {
          const languages = require('../internal/dirscan')('../languages')
          if (!languages.includes(`${parts[1]}.json`)) {
            return global.i18n.send('LANGUAGE_UNAVAILABLE', msg.channel, {
              available: languages.map(x => x.match(/(.+).json/)[1]).join(', ')
            })
          }
        }
        await engine.modify(msg.channel.guild, parts[0], parts.slice(1).join(' '))
        if (parts[0] === 'language') {
          return global.i18n.multiSend([{ _key: 'SETTINGS_MODIFIED', opts: { setting: parts[0], value: parts.slice(1).join(' ') } }, { _key: 'LANGUAGE_DISCLAIMER' }], msg.channel)
        } else {
          return global.i18n.send('SETTINGS_MODIFIED', msg.channel, {
            setting: parts[0],
            value: parts.slice(1).join(' ')
          })
        }
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
