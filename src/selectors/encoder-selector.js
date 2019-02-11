const drivers = require('../internal/dirscan')('../encoders')
const preferred = `${process.env.WILDBEAST_PREFERRED_ENCODER || 'lavalink'}.js`

if (!drivers.includes(preferred)) {
  global.logger.error(`No encoder available called ${preferred}, available choices: ${drivers.join(', ')}`, true)
}

if (global.logger) global.logger.debug(`Using ${preferred} encoder`) // HACK: docgen
module.exports = require(`../encoders/${preferred}`)
