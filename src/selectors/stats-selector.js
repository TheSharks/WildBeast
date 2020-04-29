const drivers = require('../internal/dirscan')('../statistics')
const preferred = `${process.env.WILDBEAST_PREFERRED_STATSDRIVER || 'influx'}.js`

if (preferred === 'dogstats-legacy.js') global.logger.error('Can\'t use DogstatsD in this way, please use legacy configuration if you wish to use DogstatsD', true) // DEPRECATED

if (drivers.indexOf(preferred) === -1) {
  global.logger.error(`No stats driver available called ${preferred}, available choices: ${drivers.join(', ')}`, true)
}

if (global.logger) global.logger.debug(`Using ${preferred} stats driver`)
module.exports = require(`../statistics/${preferred}`)
