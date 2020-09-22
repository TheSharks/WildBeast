require('dotenv').config()
global.logger = require('./src/internal/logger')
global.i18n = require('./src/internal/i18n')
require('./src/internal/check-env')

logger.log('BOOT', 'Beginning startup sequence...')

require('./src/internal/version-check')

process.on('warn', x => logger.warn('NODE', x))
process.on('unhandledRejection', err => logger.error('NODE', err)) // rejections might not be breaking
process.on('uncaughtException', err => logger.error('NODE', err, true)); // we're exiting here, uncaughts are scary

(async () => {
  if (process.env.WILDBEAST_K8S_AUTOSCALE) await require('./src/internal/k8s-scaling').init()
  await require('./src/components/knex').attemptMigrations()
  await require('./src/components/client').connect()
})().catch(e => logger.error('STARTUP', e, true))
