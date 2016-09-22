'use strict'
var Config = require('../../../config.json')
var Logger = require('../../internal/logger.js').Logger
var Dash = require('rethinkdbdash')
var r = new Dash()

exports.checkLevel = function (msg, user, roles) {
  return new Promise(function (resolve, reject) {
    if (Config.permissions.master.indexOf(user) > -1) {
      return resolve(Infinity) // lol
    } else if (Config.permissions.level1.indexOf(user) > -1) {
      return resolve(1)
    } else if (Config.permissions.level2.indexOf(user) > -1) {
      return resolve(2)
    } else if (Config.permissions.level3.indexOf(user) > -1) {
      return resolve(3)
    } else if (msg.isPrivate || !msg.guild) {
      return resolve(0)
    }
    getDatabaseDocument(msg.guild).then((d) => {
      var level = 0
      if (roles) {
        for (var r of roles) {
          if (d.perms.roles.level1.indexOf(r.id) > -1) {
            level = (level > 1) ? level : (level !== -1) ? 1 : -1
          } else if (d.perms.roles.level2.indexOf(r.id) > -1) {
            level = (level > 1) ? level : (level !== -1) ? 2 : -1
          } else if (d.perms.roles.level3.indexOf(r.id) > -1) {
            level = (level > 1) ? level : (level !== -1) ? 3 : -1
          } else if (d.perms.roles.negative.indexOf(r.id) > -1) {
            level = -1
          }
        }
      }
      if (d.perms.standard.level1.indexOf(user) > -1) {
        level = (level > 1) ? level : (level !== -1) ? 1 : -1
      } else if (d.perms.standard.level2.indexOf(user) > -1) {
        level = (level > 1) ? level : (level !== -1) ? 2 : -1
      } else if (d.perms.standard.level3.indexOf(user) > -1) {
        level = (level > 1) ? level : (level !== -1) ? 3 : -1
      } else if (d.perms.standard.hasOwnProperty('negative') && d.perms.negative.indexOf(user) > -1) {
        level = -1
      }
      return resolve(level)
    }).catch((e) => {
      initialize(msg.guild)
      reject(e)
    })
  })
}

exports.adjustLevel = function (msg, users, level, roles) {
  return new Promise(function (resolve, reject) {
    getDatabaseDocument(msg.guild.id).then(() => {
    }).catch(() => {
      initialize(msg.guild)
    })
  })
}

exports.restore = function (guild) {
  return new Promise(function (resolve, reject) {
    r.db('Discord').get(guild.id).delete().run().then(() => {
      initialize(guild).then(() => {
        resolve('Done!')
      }).catch((e) => {
        reject(e)
      })
    }).catch((e) => {
      reject(e)
    })
  })
}

exports.checkNSFW = function (msg) {
  return new Promise(function (resolve, reject) {
    getDatabaseDocument(msg.guild).then((d) => {
      if (d.perms.nsfw.indexOf(msg.channel.id) > -1) {
        resolve(true)
      } else {
        resolve(false)
      }
    }).catch((e) => reject(e))
  })
}

exports.adjustNSFW = function (msg, what) {
  return new Promise(function (resolve, reject) {
    /* eslint indent: 0 */
    switch (what) {
      case 'on':
        r.db('Discord').table('Guilds').get(msg.guild.id)('perms')('nsfw').append(msg.channel.id).run().then(() => resolve(1))
        break
      case 'off':
        r.db('Discord').table('Guilds').get(msg.guild.id).then((i) => {
          var doc = i
          if (doc.perms.nsfw.indexOf(msg.channel.id) > -1) {
            doc.perms.nsfw.splice(doc.perms.nsfw.indexOf(msg.channel.id), 1)
            r.db('Discord').table('Guilds').get(msg.guild.id).update(doc).run()
            resolve(0)
          } else {
            resolve(0)
          }
        })
        break
      default:
        reject('Unknown option')
        break
    }
  })
}

function initialize (guild) {
  return new Promise(function (resolve, reject) {
    var doc = {
      customize: {
        nsfw: null,
        perms: null,
        prefix: null,
        timeout: null,
        welcome: false,
        welcomeMessage: null
      },
      id: guild.id,
      lang: 'en',
      perms: {
        roles: {
          level1: [],
          level2: [],
          level3: [],
          negative: []
        },
        standard: {
          everyone: 0,
          level1: [],
          level2: [],
          level3: [],
          negative: []
        },
        nsfw: []
      },
      superUser: guild.owner_id
    }
    r.db('Discord').table('Guilds').insert(doc).run().then(() => {
      resolve('ok')
    }).catch((e) => {
      Logger.error(e)
      reject(e)
    })
  })
}

exports.isKnown = function (guild) {
  return new Promise(function (resolve, reject) {
    getDatabaseDocument(guild.id).then((r) => {
      if (r !== null) {
        return resolve()
      } else {
        return reject()
      }
    })
  })
}

function getDatabaseDocument (guild) {
  return new Promise(function (resolve, reject) {
    r.db('Discord').table('Guilds').get(guild).then((t) => {
      if (t !== null) {
        resolve(t)
      } else {
        reject(null)
      }
    })
  })
}
