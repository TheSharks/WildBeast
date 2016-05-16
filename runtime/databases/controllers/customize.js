'use strict'
var Db = require('nedb')
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
          resolve(doc[0].settings.prefix)
        } catch (e) {
          initialize(msg.guild)
          return reject()
        }
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
