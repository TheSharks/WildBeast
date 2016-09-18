'use strict'
var Dash = require('rethinkdbdash')
var r = new Dash()

exports.namechange = function (user) {
  return new Promise(function (resolve, reject) {
    getDatabaseDocument(user.id).then(() => {
      r.db('Discord').table('Users').get(user.id)('names').append(user.username).run().then(() => {
        resolve()
      }).catch(() => {
        reject()
      })
    }).catch(() => {
      initialize(user)
      reject()
    })
  })
}

exports.names = function (user) {
  return new Promise(function (resolve, reject) {
    getDatabaseDocument(user.id).then((i) => {
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
    getDatabaseDocument(user.id).then(() => {
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

function initialize (user) {
  return new Promise(function (resolve, reject) {
    var doc = {
      id: user.id,
      names: [user.username]
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
