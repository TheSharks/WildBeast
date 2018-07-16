const drivers = require('./dirscan')('../encoders')
const preferred = `${process.env['WILDBEAST_PREFERRED_ENCODER'] || 'lavalink'}.js`

if (!drivers.includes(preferred)) {
  global.logger.error(`No encoder available called ${preferred}, available choices: ${drivers.join(', ')}`, true)
}

global.logger.debug(`Using ${preferred} encoder`)
module.exports = require(`../encoders/${preferred}`)
