const drivers = require('./directory-loader')('./src/drivers')
const preferred = process.env['PREFERRED_DATABASE'] || 'arangodb'
const available = Object.getOwnPropertyNames(drivers)

if (available.indexOf(preferred) === -1) {
  console.error(`FATAL: No database driver available called ${preferred}.\nAvailable choices: ${available.join(', ')}`)
  process.exit(1)
}

module.exports = drivers[preferred]
