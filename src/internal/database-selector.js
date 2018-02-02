const drivers = require('./directory-loader')('./src/drivers')
const preferred = process.env['WILDBEAST_PREFERRED_DATABASE'] || 'arangodb'
const available = Object.getOwnPropertyNames(drivers)

if (available.indexOf(preferred) === -1) {
  global.logger.error(`No database driver available called ${preferred}, available choices: ${available.join(', ')}`, true)
}

module.exports = drivers[preferred]
