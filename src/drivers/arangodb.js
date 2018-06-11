const db = require('arangojs')(process.env['ARANGO_URI'] || 'http://localhost:8529')

db.useDatabase(process.env['ARANGO_DATABASE'] || 'wildbeast')
db.useBasicAuth(process.env['ARANGO_USERNAME'], process.env['ARANGO_PASSWORD'])

module.exports = {
  getGuildData: (guild) => {
    return ensureGuild(guild)
  },
  getPerms: (guild) => {
    return getSelection(guild, 'perms')
  },
  getSettings: (guild) => {
    return getSelection(guild, 'settings')
  },
  getFlags: async (guild) => {
    const res = await ensureSystem(guild)
    return res.flags
  },
  getOverrides: async (guild) => {
    const res = await ensureSystem(guild)
    return res.overrides
  },
  getTag: (key) => {
    return module.exports.getArbitrary(key, 'tags')
  },
  getArbitrary: async (key, coll) => {
    const collection = db.collection(coll)
    try {
      const doc = await collection.document(key)
      return doc
    } catch (e) {
      return null
    }
  },
  create: async (coll, data) => {
    const collection = db.collection(coll)
    let newdoc = await collection.save(data, {
      returnNew: true
    })
    return newdoc.new
  },
  delete: (coll, key) => {
    const collection = db.collection(coll)
    return collection.remove(key)
  },
  edit: (handle, data, coll = 'guild_data', opts = {
    keepNull: false // values set to null will be deleted instead of being saved
  }) => {
    let collection = db.collection(coll)
    return collection.update(handle, data, opts)
  },
  _driver: db
}

function getSelection (guild, select) {
  return new Promise(async (resolve, reject) => {
    let data = await ensureGuild(guild)
    return resolve(data[select])
  })
}

async function ensureSystem (guild) {
  let collection = db.collection('system')
  try {
    let doc = await collection.document(guild.id)
    global.logger.trace(doc)
    return doc
  } catch (e) {
    let newdoc = await module.exports.create('system', {
      _key: guild.id,
      flags: [],
      overrides: {}
    })
    global.logger.trace(newdoc)
    return newdoc
  }
}

async function ensureGuild (guild) {
  let collection = db.collection('guild_data')
  try {
    let doc = await collection.document(guild.id)
    global.logger.trace(doc)
    return doc
  } catch (e) {
    let newdoc = await module.exports.create('guild_data', {
      _key: guild.id,
      perms: {
        users: {},
        roles: {}
      },
      settings: {}
    })
    global.logger.trace(newdoc)
    return newdoc
  }
}
