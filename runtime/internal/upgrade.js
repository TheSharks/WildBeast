'use strict'
var counter = 0
var count = 0
var ora = require('ora')
var Db = require('nedb')
var prompt = require('prompt')
var Logger = require('./logger.js').Logger
var newPerms = new Db({
  filename: './runtime/databases/perms'
})
var newCust = new Db({
  filename: './runtime/databases/customize'
})
var newUser = new Db({
  filename: './runtime/databases/users'
})
var oldPerms = new Db({
  filename: './runtime/databases/incoming/permissionstorage'
})
var oldCust = new Db({
  filename: './runtime/databases/incoming/customizationstore'
})
var oldUser = new Db({
  filename: './runtime/databases/incoming/user_nsastore'
})

exports.init = function () {
  return new Promise(function (resolve, reject) {
    prompt.start()
    var property = {
      name: 'yesno',
      message: '\nPut your old databases in the incoming folder located in runtime.\nAre you done?',
      validator: /y[es]*|n[o]?/,
      warning: 'Must respond yes or no',
      default: 'yes'
    }
    prompt.get(property, function (err, result) {
      if (err) {
        return reject(err)
      }
      if (result.yesno === 'yes') {
        perms().then(() => {
          cust().then(() => {
            user().then(() => {
              resolve('All transfers completed!')
            }).catch((e) => {
              Logger.error(e)
            })
          }).catch((e) => {
            Logger.error(e)
          })
        }).catch((e) => {
          Logger.error(e)
        })
      } else {
        reject('Okbye')
        process.exit(1)
      }
    })
  })
}

function perms () {
  const load = ora('Transferring permissions.')
  load.start()
  return new Promise(function (resolve, reject) {
    newPerms.loadDatabase()
    oldPerms.loadDatabase()
    oldPerms.count({}, function (err, c) {
      if (err) {
        reject('Counting error, ' + err)
      } else if (c) {
        count = c
      }
    })
    oldPerms.find({}, function (err, docs) {
      if (err) {
        reject('Permission fetch error, ' + err)
      } else if (docs) {
        docs.map((old) => {
          var doc = {
            _id: old._id,
            superUser: old.superUser,
            blacklisted: false,
            perms: {
              level1: old.permissions.level1,
              level2: old.permissions.level2,
              level3: old.permissions.level3,
              nsfw: old.nsfw_permissions.allowed
            }
          }
          newPerms.insert(doc, function (err, doc) {
            if (err) {
              reject('Insertion failiure, ' + err)
            } else if (doc) {
              counter++
              if (counter >= count) {
                load.stop()
                Logger.info('Permission transfer complete, transferred ' + counter + ' documents.')
                count = 0
                counter = 0
                resolve()
              }
            }
          })
        })
      }
    })
  })
}

function cust () {
  const load = ora('Transferring customizations.')
  load.start()
  return new Promise(function (resolve, reject) {
    newCust.loadDatabase()
    oldCust.loadDatabase()
    oldCust.count({}, function (err, c) {
      if (err) {
        reject('Counting error, ' + err)
      } else if (c) {
        count = c
      }
    })
    oldCust.find({}, function (err, docs) {
      if (err) {
        reject('Customization fetch error, ' + err)
      } else if (docs) {
        docs.map((old) => {
          var doc = {
            _id: old._id,
            replies: {
              permissions: old.responses.no_permission_response,
              welcome: old.responses.welcome_message,
              nsfw: old.responses.nsfw_disallowed_response,
              timeout: 'default'
            },
            settings: {
              welcoming: old.settings.welcoming,
              prefix: false
            }
          }
          newCust.insert(doc, function (err, doc) {
            if (err) {
              reject('Insertion failiure, ' + err)
            } else if (doc) {
              counter++
              if (counter >= count) {
                load.stop()
                Logger.info('Customization transfer complete, transferred ' + counter + ' documents.')
                count = 0
                counter = 0
                resolve()
              }
            }
          })
        })
      }
    })
  })
}

function user () {
  const load = ora('Transferring user database.')
  load.start()
  return new Promise(function (resolve, reject) {
    newUser.loadDatabase()
    oldUser.loadDatabase()
    oldUser.count({}, function (err, c) {
      if (err) {
        reject('Counting error, ' + err)
      } else if (c) {
        count = c
      }
    })
    oldUser.find({}, function (err, docs) {
      if (err) {
        reject('User database fetch error, ' + err)
      } else if (docs) {
        docs.map((old) => {
          var doc = {
            _id: old._id,
            names: old.known_names,
            blacklisted: false
          }
          newUser.insert(doc, function (err, doc) {
            if (err) {
              reject('Insertion failiure, ' + err)
            } else if (doc) {
              counter++
              if (counter >= count) {
                load.stop()
                Logger.info('User database transfer complete, transferred ' + counter + ' documents.')
                resolve('All transfers completed!')
                count = 0
                counter = 0
              }
            }
          })
        })
      }
    })
  })
}

exports.incomInit = function () {
  return new Promise(function (resolve) {
    return resolve('lol no upgrade for you <3') // Seeing that this file is amde to upgrade databases, and incompatible versions dont have correct databases, just quit the function
  })
}
