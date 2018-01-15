const db = require('arangojs')()

db.useDatabase(process.env['ARANGO_DATABASE'] || 'wildbeast')

module.exports = {
  getGuildData: (guild) => {
    let collection = db.collection('guild_data')
    return collection.document(guild.id)
  },
  getPerms: (guild) => {
    return new Promise(async (resolve, reject) => {
      let collection = db.collection('guild_data')
      let data = await collection.document(guild.id)
      return resolve(data.perms)
    })
  }
}
