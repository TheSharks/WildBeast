const db = require('arangojs')(process.env['ARANGO_URI'] || 'http://localhost:8529')

db.useDatabase(process.env['ARANGO_DATABASE'] || 'wildbeast')
db.useBasicAuth(process.env['ARANGO_USERNAME'], process.env['ARANGO_PASSWORD'])

module.exports = {
  getGuildData: (guild) => {
    return ensure(guild)
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
    let data = await ensure(guild)
    return resolve(data[select])
  })
}

async function ensure (guild) {
  let collection = db.collection('guild_data')
  try {
    let doc = await collection.document(guild.id)
    return doc
  } catch (e) {
    let newdoc = await collection.save({
      _id: guild.id,
      perms: {},
      settings: {}
    }, {
      returnNew: true
    })
    return newdoc.new
  }
}
