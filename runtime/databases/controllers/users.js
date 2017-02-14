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

exports.namechange = function (user) {
  return new Promise(function (resolve, reject) {
    getDatabaseDocument(user).then((d) => {
      if (d.names[d.names.length - 1] === user.username) {
        resolve()
      } else {
        d.names.push(user.username)
        r.db('Discord').table('Users').get(user.id).update(d).run().then(() => {
          resolve()
        }).catch((e) => {
          reject(e)
        })
      }
    }).catch((e) => {
      initialize(user)
      reject(e)
    })
  })
}

exports.names = function (user) {
  return new Promise(function (resolve, reject) {
    getDatabaseDocument(user).then((i) => {
      try {
        resolve(i.names)
      } catch (e) {
        initialize(user)
        reject(e)
      }
    })
  })
}

exports.isKnown = function (user) {
  return new Promise(function (resolve, reject) {
    getDatabaseDocument(user).then(() => {
      resolve()
    }).catch(() => {
      initialize(user).then(() => {
        resolve()
      }).catch(() => {
        reject()
      })
    })
  })
}

exports.globalBan = function (what, user, reason) {
  return new Promise((resolve, reject) => {
    getDatabaseDocument(user).then(d => {
      switch (what) {
        case 'status':
          resolve((d.banned !== undefined && d.banned === true) ? `${d.names[d.names.length - 1]} has been globally banned for: ${d.banReason}` : 'User is not globally banned.')
          break
        case 'unban':
          d.banned = false
          d.banReason = undefined
          r.db('Discord').table('Users').get(user).update(d).run().then(() => {
            resolve(`${d.names[d.names.length - 1]} has been globally unbanned.`)
          }).catch(err => {
            reject(err)
          })
          break
        case 'ban':
          d.banned = true
          d.banReason = reason
          r.db('Discord').table('Users').get(user).update(d).run().then(() => {
            resolve(`${d.names[d.names.length - 1]} has been globally banned.`)
          }).catch(err => {
            reject(err)
          })
          break
        default:
          resolve((d.banned !== undefined && d.banned === true) ? `${d.names[d.names.length - 1]} has been globally banned for: ${d.banReason}` : 'User is not globally banned.')
          break
      }
    })
  })
}

function initialize (user) {
  return new Promise(function (resolve, reject) {
    var doc = {
      id: user.id,
      names: [user.username],
      banned: false,
      banReason: undefined
    }
    r.db('Discord').table('Users').insert(doc).run().then(() => {
      resolve()
    }).catch((e) => {
      reject(e)
    })
  })
}

function getDatabaseDocument (user) {
  return new Promise(function (resolve, reject) {
    user = typeof user === 'object' ? user.id : user
    r.db('Discord').table('Users').get(user).then((i) => {
      if (i !== null) {
        resolve(i)
      } else {
        reject(null)
      }
    }).catch((e) => {
      reject(e)
    })
  })
}
