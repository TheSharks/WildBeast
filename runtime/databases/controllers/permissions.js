'use strict'
var Config = require('../../../config.json')
var Logger = require('../../internal/logger.js').Logger
var Dash = require('rethinkdbdash')
var r = new Dash({
  servers: [{
    host: Config.database.host,
    port: Config.database.port
  }]
})

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
      if (user.id === d.superUser) {
        return resolve(4)
      }
      var level = d.perms.standard.everyone
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
      } else if (d.perms.standard.negative.indexOf(user) > -1) {
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
    getDatabaseDocument(msg.guild).then((d) => {
      var roleIds = roles.map((x) => x.id)
      var userIds = users.map((x) => x.id)

      if (msg.mention_everyone) {
        d.perms.standard.everyone = level
      }

      d.perms.roles.level1 = d.perms.roles.level1.filter((el) => roleIds.indexOf(el) < 0)
      d.perms.roles.level2 = d.perms.roles.level2.filter((el) => roleIds.indexOf(el) < 0)
      d.perms.roles.level3 = d.perms.roles.level3.filter((el) => roleIds.indexOf(el) < 0)
      d.perms.roles.negative = d.perms.roles.negative.filter((el) => roleIds.indexOf(el) < 0)

      if (d.perms.roles.hasOwnProperty('level' + level)) {
        d.perms.roles['level' + level].push.apply(d.perms.roles['level' + level], roleIds)
      } else if (level < 0) {
        d.perms.roles.negative.push.apply(d.perms.roles.negative, roleIds)
      }

      d.perms.standard.level1 = d.perms.standard.level1.filter((el) => userIds.indexOf(el) < 0)
      d.perms.standard.level2 = d.perms.standard.level2.filter((el) => userIds.indexOf(el) < 0)
      d.perms.standard.level3 = d.perms.standard.level3.filter((el) => userIds.indexOf(el) < 0)
      d.perms.standard.negative = d.perms.standard.negative.filter((el) => userIds.indexOf(el) < 0)

      if (d.perms.standard.hasOwnProperty('level' + level)) {
        d.perms.standard['level' + level].push.apply(d.perms.standard['level' + level], userIds)
      } else if (level < 0) {
        d.perms.standard.negative.push.apply(d.perms.standard.negative, userIds)
      }

      r.db('Discord').table('Guilds').update(d).run().then(() => {
        resolve('Done!')
      }).catch((e) => {
        reject(e)
      })
    }).catch(() => {
      initialize(msg.guild)
      reject()
    })
  })
}

exports.restore = function (guild) {
  return new Promise(function (resolve, reject) {
      getDatabaseDocument(guild).then((d) => {
          r.db('Discord').table('Guilds').delete(d).run().then(() => {
              initialize(guild).then(() => {
                  resolve('Done!')
              }).catch((e) => {
                  reject(e)
              })
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
        getDatabaseDocument(msg.guild).then((d) => {
          if (d.perms.nsfw.indexOf(msg.channel.id) > -1) {
            resolve(1)
          } else {
            d.perms.nsfw.push(msg.channel.id.toString())
            r.db('Discord').table('Guilds').update(d).run().then(() => {
              resolve(1)
            }).catch((e) => {
              Logger.error(e)
              reject(e)
            })
          }
        }).catch((e) => reject(e))
        break
      case 'off':
        getDatabaseDocument(msg.guild).then((d) => {
          if (d.perms.nsfw.indexOf(msg.channel.id) > -1) {
            d.perms.nsfw.splice(d.perms.nsfw.indexOf(msg.channel.id), 1)
              r.db('Discord').table('Guilds').update(d).run().then(() => {
                resolve(0)
            }).catch((e) => {
                Logger.error(e)
                reject(e)
            })
          } else {
            resolve(0)
          }
        }).catch((e) => reject(e))
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
    getDatabaseDocument(guild).then((r) => {
      if (r !== null) {
        return resolve()
      } else {
        return reject()
      }
    }).catch((e) => {
      reject(e)
    })
  })
}

function getDatabaseDocument (guild) {
  return new Promise(function (resolve, reject) {
    r.db('Discord').table('Guilds').get(guild.id).then((t) => {
      if (t !== null) {
        resolve(t)
      } else {
        reject(null)
      }
    }).catch((e) => {
      reject(e)
    })
  })
}
