const drivers = require('./directory-loader')('./src/encoders')
const preferred = process.env['WILDBEAST_PREFERRED_ENCODER'] || 'lavalink'
const available = Object.getOwnPropertyNames(drivers)

if (!available.includes(preferred)) {
  global.logger.error(`No encoder available called ${preferred}, available choices: ${available.join(', ')}`, true)
}

module.exports = drivers[preferred]