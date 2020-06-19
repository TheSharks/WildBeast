const knex = require('knex')
const logger = require('../internal/logger.js')
let config = {
  migrations: {
    directory: './src/database/migrations'
  },
  useNullAsDefault: true,
  client: 'sqlite3',
  connection: {
    filename: './wildbeast.sqlite'
  }
}

try {
  config = require('../../knexfile.js')
} catch (_) {
  logger.debug('KNEX', 'No knexfile, using default config')
}

const driver = knex(config)

module.exports = driver
module.exports.attemptMigrations = async function () {
  logger.log('KNEX', 'Checking if database is up-to-date...')
  const migrations = await driver.migrate.list()
  if (migrations[1].length > 0) {
    logger.log('KNEX', 'Database not fully migrated! Running latest migrations...')
    await driver.migrate.latest()
    logger.log('KNEX', 'Database updated!')
  } else {
    logger.log('KNEX', 'Database is fully up-to-date')
  }
}
