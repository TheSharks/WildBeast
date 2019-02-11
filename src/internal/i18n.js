const standard = process.env.WILDBEAST_LANGUAGE || 'en-EN'
const available = require('./directory-loader')('../languages', { regex: /\.json$/ })
const driver = require('../selectors/database-selector')

if (!available[standard]) global.logger.error(`Unable to load language file ${standard}. It does not exist.`, true)

module.exports = {
  raw: (key, opts, lang) => {
    if (available[lang]) return transform(available[lang][key], opts)
    else return transform(available[standard][key], opts)
  },
  send: async (key, channel, opts) => {
    let settings
    if (channel.guild) settings = await driver.getSettings(channel.guild)
    if (settings && available[settings.language] && available[settings.language][key]) return channel.createMessage(transform(available[settings.language][key], opts))
    else if (!available[standard][key]) return global.logger.error(`Missing i18n key ${key} from standard language file!`)
    else return channel.createMessage(transform(available[standard][key], opts))
  },
  multiRaw: async (strings, language) => {
    if (language && available[language]) {
      return strings.map(v => transform(available[language][v._key], v.opts))
    } else {
      return strings.map(v => transform(available[standard][v._key], v.opts))
    }
  },
  multiSend: async (strings, channel) => {
    const requested = strings.map(v => v._key)
    for (let v of requested) {
      if (!available[standard][v]) return global.logger.error(`Missing i18n key ${v} from standard language file!`)
    }
    let settings
    if (channel.guild) settings = await driver.getSettings(channel.guild)
    if (settings && available[settings.language]) channel.createMessage(strings.map(v => transform(available[settings.language][v._key], v.opts)).join('\n'))
    else channel.createMessage(strings.map(v => transform(available[standard][v._key], v.opts)).join('\n'))
  }
}

function transform (string, opts) {
  for (let x in opts) {
    string = string.replace(new RegExp(`{${x}}`, 'g'), opts[x])
  }
  return string
}
