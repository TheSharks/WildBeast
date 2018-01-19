const db = require('arangojs')(process.env['ARANGO_URI'] || 'http://localhost:8529')

db.useDatabase(process.env['ARANGO_DATABASE'] || 'wildbeast')
db.useBasicAuth(process.env['ARANGO_USERNAME'], process.env['ARANGO_PASSWORD'])

module.exports = {
  getGuildData: (guild) => {
    let collection = db.collection('guild_data')
    return collection.document(guild.id)
  },
  getPerms: (guild) => {
    return getSelection(guild, 'perms')
  },
  getSettings: (guild) => {
    return getSelection(guild, 'settings')
  }
}

function getSelection (guild, select) {
  return new Promise(async (resolve, reject) => {
    let collection = db.collection('guild_data')
    let data = await collection.document(guild.id).catch(reject)
    return resolve(data[select])
  })
}
