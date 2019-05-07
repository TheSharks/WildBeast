require('dotenv').config()
global.logger = require('./src/internal/logger')
global.i18n = require('./src/internal/i18n')
global.chalk = require('chalk')
require('./src/internal/check-env')

logger.log('BOOT', 'Beginning startup sequence...')

require('./src/internal/version-check')

process.on('warn', logger.warn)

process.on('unhandledRejection', (err) => {
  logger.error(err)
})

process.on('uncaughtException', (err) => {
  // probably not the most stylish way to handle this, but it works
  logger.error(err, true) // we're exiting here, uncaughts are scary
})

require('./src/components/client').connect()
