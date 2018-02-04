const standard = process.env.WILDBEAST_LANGUAGE || 'en'
const available = require('./directory-loader')('./src/languages', /\.json$/)
const driver = require('./database-selector')

if (!available[standard]) {
  global.logger.error(`Unable to load language file ${standard}. It does not exist.`, true)
}

module.exports = {
  raw: (key, opts) => {
    return transform(available[standard][key], opts)
  },
  send: async (key, channel, opts) => {
    let settings
    if (channel.guild) settings = await driver.getSettings(channel.guild)
    if (settings && available[settings.language]) return channel.createMessage(transform(available[settings.language][key], opts))
    else return channel.createMessage(transform(available[standard][key], opts))
  }
}

function transform (string, opts) {
  for (let x in opts) {
    string = string.replace(new RegExp(`{${x}}`, 'g'), opts[x])
  }
  return string
}
