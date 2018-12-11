let guilds, system, tags
const Loki = require('lokijs')
const db = new Loki('wildbeast.db', {
  autoload: true,
  autosave: true,
  autoloadCallback: loadCollections,
  autosaveInterval: 1000
})

function loadCollections () {
  guilds = db.getCollection('guild_data') || db.addCollection('guild_data')
  system = db.getCollection('system') || db.addCollection('system')
  tags = db.getCollection('tags') || db.addCollection('tags')
}

module.exports = {
  getGuildData: async (guild) => {
    return ensureGuild(guild)
  },
  getPerms: async (guild) => {
    const data = ensureGuild(guild)
    return data.perms
  },
  getSettings: async (guild) => {
    const data = ensureGuild(guild)
    return data.settings
  },
  getFlags: async (guild) => {
    const data = ensureSystem(guild)
    return data.flags
  },
  getOverrides: async (guild) => {
    const data = ensureSystem(guild)
    return data.overrides
  },
  getArbitrary: async (key, coll) => {
    const collection = db.getCollection(coll)
    return collection.findOne({ wb_id: key })
  },
  getTag: async (key) => {
    return tags.findOne({ wb_id: key })
  },
  create: async (coll, data) => {
    if (data._key) {
      data.wb_id = data._key
      delete data._key
    }
    const collection = db.getCollection(coll)
    return collection.insert(data)
  },
  delete: async (coll, key) => {
    const collection = db.getCollection(coll)
    return collection.remove(collection.findOne({ wb_id: key }))
  },
  edit: async (handle, data, coll = 'guild_data') => {
    const collection = db.getCollection(coll)
    const orig = collection.find({ wb_id: handle })[0]
    const newdata = { ...orig, ...data } // spread ops, fancy!
    return collection.update(newdata)
  }
}

function ensureGuild (guild) {
  const data = guilds.find({
    wb_id: guild.id
  })[0]
  if (data) {
    global.logger.trace(data)
    return data
  } else {
    const shim = {
      wb_id: guild.id,
      perms: {
        users: {},
        roles: {}
      },
      settings: {}
    }
    guilds.insert(shim)
    return shim
  }
}

function ensureSystem (guild) {
  const data = system.find({
    wb_id: guild.id
  })[0]
  if (data) {
    global.logger.trace(data)
    return data
  } else {
    const shim = {
      wb_id: guild.id,
      flags: [],
      overrides: {}
    }
    system.insert(shim)
    return shim
  }
}
