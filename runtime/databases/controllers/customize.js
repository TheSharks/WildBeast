'use strict'
var Config = require('../../../config.json')
var Dash = require('rethinkdbdash')
var r = new Dash({
  user: Config.database.user,
  password: Config.database.password,
  silent: true,
  servers: [{
    host: Config.database.host,
    port: Config.database.port
  }]
})
var Logger = require('../../internal/logger.js').Logger
var bugsnag = require('bugsnag')
bugsnag.register(Config.api_keys.bugsnag)

exports.prefix = function (msg) {
  return new Promise(function (resolve, reject) {
    if (msg.isPrivate) {
      return resolve(false)
    }
    getDatabaseDocument(msg.guild).then((i) => {
      resolve((i.customize.prefix === null) ? false : i.customize.prefix)
    }).catch(() => {
      initialize(msg.guild)
      reject('No database')
    })
  })
}

exports.check = function (guild) {
  return new Promise(function (resolve, reject) {
    getDatabaseDocument(guild).then((i) => {
      resolve(i.customize.welcome)
    }).catch(() => {
      initialize(guild)
      reject('No database')
    })
  })
}

exports.reply = function (msg, what) {
  return new Promise(function (resolve, reject) {
    getDatabaseDocument(msg.guild).then((t) => {
      if (!t.customize.hasOwnProperty(what)) {
        return reject('Unsupported reply method')
      } else {
        return resolve(t.customize[what])
      }
    }).catch((e) => {
      initialize(msg.guild)
      reject(e)
    })
  })
}

exports.helpHandle = function (msg) {
  // You will just have to deal with the fact that this is static
  var arr = []
  arr.push('`customize` enables you to adjust various settings about my behaviour in your server.')
  arr.push('Currently, I support the following.')
  arr.push('\n')
  arr.push('`nsfw`: Changes my reply when someones uses a NSFW command while I disallow that.')
  arr.push('`permissions`: Changes my reply when someone tries to use a command they do not have access to')
  arr.push('`welcome`: Changes my welcoming message.')
  arr.push('`welcoming`: Changes wether I should welcome new people.')
  arr.push('`timeout`: Changes my reply when someones uses a command that is still in cooldown')
  arr.push('`prefix`: Changes the prefix I listen to on this server, mentions will still count as a global prefix')
  arr.push('\n')
  arr.push('Some customize methods support special words, here is what they are and how to use them.')
  arr.push('**Note the following:**')
  arr.push('```')
  arr.push('You cannot use special words with welcoming or prefix.')
  arr.push('All special words start with %.')
  arr.push('You can use multiple special words within one message.')
  arr.push('```')
  arr.push('`%user`: Refers to the username of the user who triggered this response.')
  arr.push('`%channel`: Refers to the channel wherein this response is triggered, does not work with welcome.')
  arr.push('`%server`: Refers to the server name')
  arr.push('`%timeout`: Refers to the amount of seconds the used command cools down for, __can only be used with timeout__.')
  arr.push('`%nlevel`: Short for NeedLevel. Refers to the access level an user needs to execute this command, __can only be used with permissions__.')
  arr.push('`%ulevel`: Short for UserLevel. Refers to the access level an user has right now, __can only be used with permissions__.')
  arr.push('For more information, check http://docs.thesharks.xyz/commands/, the Customize command section.')
  msg.author.openDM().then((y) => {
    y.sendMessage(arr.join('\n'))
  }).catch((e) => {
    Logger.error(e)
    msg.channel.sendMessage('Whoops, try again.')
  })
}

exports.restore = function (guild) {
  return new Promise(function (resolve, reject) {
    getDatabaseDocument(guild).then(() => {
      r.db('Discord').table('Guilds').get(guild.id).delete().run().then(() => {
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

exports.adjust = function (msg, what, how) {
  /* eslint indent: 0 */
  return new Promise(function (resolve, reject) {
    getDatabaseDocument(msg.guild).then(() => {
      switch (what) {
        case 'nsfw':
          r.db('Discord').table('Guilds').get(msg.guild.id).update({
            customize: {
              nsfw: how
            }
          }).run().then(() => {
            resolve(how)
          }).catch((e) => {
            reject(e)
          })
          break
        case 'permissions':
          r.db('Discord').table('Guilds').get(msg.guild.id).update({
            customize: {
              perms: how
            }
          }).run().then(() => {
            resolve(how)
          }).catch((e) => {
            reject(e)
          })
          break
        case 'prefix':
          if (how.indexOf('"') === -1) {
            return reject('`Put new prefixes between double quotes please.`')
          }
          r.db('Discord').table('Guilds').get(msg.guild.id).update({
            customize: {
              prefix: how.split('"')[1]
            }
          }).run().then(() => {
            resolve(how.split('"')[1])
          }).catch((e) => {
            reject(e)
          })
          break
        case 'timeout':
          r.db('Discord').table('Guilds').get(msg.guild.id).update({
            customize: {
              timeout: how
            }
          }).run().then(() => {
            resolve(how)
          }).catch((e) => {
            reject(e)
          })
          break
        case 'welcoming':
          if (how !== 'on' && how !== 'off' && how !== 'private' && how !== 'channel') {
            return reject('`Invalid target.`')
          }
          r.db('Discord').table('Guilds').get(msg.guild.id).update({
            customize: {
              welcome: how
            }
          }).run().then(() => {
            resolve(how)
          }).catch((e) => {
            reject(e)
          })
          break
        case 'welcome':
          r.db('Discord').table('Guilds').get(msg.guild.id).update({
            customize: {
              welcomeMessage: how
            }
          }).run().then(() => {
            resolve(how)
          }).catch((e) => {
            reject(e)
          })
          break
        default:
          reject('Unsupported method')
          break
      }
    }).catch(() => {
      initialize(msg.guild)
      reject('No database')
    })
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
