require('dotenv').config()
require('./secrets-loader')

const tables = [
  'guild_data', // saves guild configurations
  'tags', // saves tags
  'system' // misc things
]

const driver = require('arangojs')(process.env['ARANGO_URI'] || 'http://localhost:8529')
const logger = console // dropin change

driver.useBasicAuth(process.env['ARANGO_USERNAME'], process.env['ARANGO_PASSWORD'])

if (process.env.WILDBEAST_PREFERRED_DATABASE && process.env.WILDBEAST_PREFERRED_DATABASE !== 'arangodb') {
  logger.error(`This script will only work on ArangoDB, not on your requested driver, ${process.env.WILDBEAST_PREFERRED_DATABASE}`, true)
}

driver.listDatabases().then(async databases => {
  if (databases.includes(process.env.ARANGO_DATABASE || 'wildbeast')) {
    logger.log('Database exists, checking for collections.')
    driver.useDatabase(process.env.ARANGO_DATABASE || 'wildbeast')
    return driver.listCollections()
  } else {
    logger.log('Database does not exist, creating...')
    await driver.createDatabase(process.env.ARANGO_DATABASE || 'wildbeast')
    logger.log('Database created, moving on to creating collections.')
    driver.useDatabase(process.env.ARANGO_DATABASE || 'wildbeast')
    return driver.listCollections()
  }
}).then(collections => {
  let names = []
  collections.map(c => names.push(c.name))
  tables.map(x => {
    if (names.includes(x)) logger.log(`Collection ${x} already exists.`)
    else {
      const coll = driver.collection(x)
      coll.create().then(() => {
        logger.log(`Collection ${x} has been created.`)
      })
    }
  })
  // the event loop is done, no need to process.exit
})
