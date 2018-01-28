require('dotenv').config()

const driver = require('arangojs')(process.env['ARANGO_URI'] || 'http://localhost:8529')
const logger = require('./logger')

driver.useBasicAuth(process.env['ARANGO_USERNAME'], process.env['ARANGO_PASSWORD'])

if (process.env.WILDBEAST_PREFERRED_DATABASE && process.env.WILDBEAST_PREFERRED_DATABASE !== 'arangodb') {
  logger.error(`This script will only work on ArangoDB, not on your requested driver, ${process.env.WILDBEAST_PREFERRED_DATABASE}`, true)
}

driver.listDatabases().then(async databases => {
  if (databases.includes(process.env.ARANGO_DATABASE || 'wildbeast')) {
    logger.log('Database exists, checking for collections.')
    driver.useDatabase(process.env.ARANGO_DATABASE || 'wildbeast')
    return driver.collections()
  } else {
    logger.log('Database does not exist, creating...')
    await driver.createDatabase(process.env.ARANGO_DATABASE || 'wildbeast')
    logger.log('Database created, moving on to creating collections.')
    driver.useDatabase(process.env.ARANGO_DATABASE || 'wildbeast')
    return driver.collections()
  }
}).then(collections => {
  collections.map(coll => {
    if (coll.name === 'guild_data') {
      logger.log('Collection exists, exiting.')
      process.exit()
    }
  })
  logger.log('Collection does not exist, creating...')
  const coll = driver.collection('guild_data')
  coll.create().then(() => {
    logger.log('Collection created, exiting.')
    process.exit()
  })
})
