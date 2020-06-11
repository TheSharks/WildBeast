require('dotenv').config()
global.logger = require('./src/internal/logger')
require('./src/internal/check-env')

logger.log('BOOT', 'Beginning startup sequence...')

require('./src/internal/version-check')

process.on('warn', x => logger.warn('NODE', x))
process.on('unhandledRejection', err => logger.error('NODE', err)) // rejections might not be breaking
process.on('uncaughtException', err => logger.error('NODE', err, true)) // we're exiting here, uncaughts are scary

require('./src/components/client').connect()
