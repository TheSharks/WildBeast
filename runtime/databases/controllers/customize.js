'use strict'
var Db = require('nedb')
var Logger = require('../../internal/logger.js').Logger
var database = new Db({
  filename: './runtime/databases/customize',
  autoload: true
})

exports.prefix = function (msg) {
  return new Promise(function (resolve, reject) {
    if (msg.isPrivate) {
      return resolve(false)
    }
    database.find({
      _id: msg.guild.id
    }, function (err, doc) {
      if (err) {
        reject(err)
      } else if (doc) {
        if (doc.length <= 0) {
          initialize(msg.guild)
          return reject()
        }
        try {
          return resolve(doc[0].settings.prefix)
        } catch (e) {
          initialize(msg.guild)
          return reject('Try/catch block reject!')
        }
      }
    })
  })
}

exports.check = function (guild) {
  return new Promise(function (resolve, reject) {
    database.find({
      _id: guild.id
    }, function (err, doc) {
      if (err) {
        reject(err)
      } else if (doc) {
        resolve(doc[0].settings.welcoming)
      }
    })
  })
}

exports.reply = function (msg, what) {
  return new Promise(function (resolve, reject) {
    database.find({
      _id: msg.guild.id
    }, function (err, doc) {
      if (err) {
        reject(err)
      } else if (doc) {
        if (!doc[0].replies.hasOwnProperty(what)) {
          reject('Not supported!')
        } else {
          resolve(doc[0].replies[what])
        }
      }
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
  msg.author.openDM().then((y) => {
    y.sendMessage(arr.join('\n'))
  }).catch((e) => {
    Logger.error(e)
    msg.channel.sendMessage('Whoops, try again.')
  })
}

exports.restore = function (guild) {
  return new Promise(function (resolve, reject) {
    database.find({
      _id: guild.id
    }, function (err, docs) {
      if (err) {
        reject(err)
      } else if (docs) {
        if (docs.length > 0) {
          database.remove({
            _id: guild.id
          }, function (err) {
            if (err) {
              return reject(err)
            }
          })
        }
      }
      initialize(guild).then(() => {
        return resolve('Done!')
      }).catch((e) => {
        return reject(e)
      })
    })
  })
}

exports.adjust = function (msg, what, how) {
  /*eslint indent: 0*/
  return new Promise(function (resolve, reject) {
    database.find({
      _id: msg.guild.id
    }, function (err, doc) {
      if (err) {
        reject(err)
      } else if (doc) {
        switch (what) {
          case 'welcoming':
            if (how !== 'off' && how !== 'private' && how !== 'channel') {
              return reject('Welcoming can only be `off`, `private` or `channel`')
            }
            database.update({
              _id: msg.guild.id
            }, {
              $set: {
                'settings.welcoming': how
              }
            }, {}, function (err, doc) {
              if (err) {
                reject(err)
              } else if (doc) {
                resolve(how)
              }
            })
            break
          case 'nsfw':
            database.update({
              _id: msg.guild.id
            }, {
              $set: {
                'replies.nsfw': how
              }
            }, {}, function (err, doc) {
              if (err) {
                reject(err)
              } else if (doc) {
                resolve(how)
              }
            })
            break
          case 'permissions':
            database.update({
              _id: msg.guild.id
            }, {
              $set: {
                'replies.permissions': how
              }
            }, {}, function (err, doc) {
              if (err) {
                reject(err)
              } else if (doc) {
                resolve(how)
              }
            })
            break
          case 'welcome':
            database.update({
              _id: msg.guild.id
            }, {
              $set: {
                'replies.welcome': how
              }
            }, {}, function (err, doc) {
              if (err) {
                reject(err)
              } else if (doc) {
                resolve(how)
              }
            })
            break
          case 'timeout':
            database.update({
              _id: msg.guild.id
            }, {
              $set: {
                'replies.timeout': how
              }
            }, {}, function (err, doc) {
              if (err) {
                reject(err)
              } else if (doc) {
                resolve(how)
              }
            })
            break
          case 'prefix':
            if (how.indexOf('"') === -1) {
              return reject('`Put new prefixes between double quotes please.`')
            }
            database.update({
              _id: msg.guild.id
            }, {
              $set: {
                'settings.prefix': how.split('"')[1]
              }
            }, {}, function (err, doc) {
              if (err) {
                reject(err)
              } else if (doc) {
                resolve(how.split('"')[1])
              }
            })
            break
          default:
            reject('Not supported!')
        }
      }
    })
  })
}

function initialize (guild) {
  return new Promise(function (resolve, reject) {
    var doc = {
      _id: guild.id,
      replies: {
        permissions: 'default',
        welcome: 'default',
        nsfw: 'default',
        timeout: 'default'
      },
      settings: {
        welcoming: false,
        prefix: false
      }
    }
    database.insert(doc, function (err, doc) {
      if (err) {
        reject(err)
      } else if (doc) {
        resolve('ok')
      }
    })
  })
}

exports.isKnown = function (guild) {
  return new Promise(function (resolve, reject) {
    database.find({
      _id: guild.id
    }, function (err, docs) {
      if (err) {
        reject(err)
      } else if (docs) {
        if (docs.length <= 0) {
          initialize(guild).then((r) => {
            resolve(r)
          }).catch((e) => {
            reject(e)
          })
        } else {
          resolve()
        }
      }
    })
  })
}

exports.Database = database
