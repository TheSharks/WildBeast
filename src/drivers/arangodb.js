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
  },
  edit: (handle, data, opts = {
    keepNull: false // values set to null will be deleted instead of being saved
  }) => {
    let collection = db.collection('guild_data')
    return collection.update(handle, data, opts)
  },
  _driver: db
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
      _key: guild.id,
      perms: {
        users: {},
        roles: {}
      },
      settings: {}
    }, {
      returnNew: true
    })
    return newdoc.new
  }
}
