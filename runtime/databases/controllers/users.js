'use strict'
var Dash = require('rethinkdbdash')({
  servers: [
    {host: '50.3.72.123', port: 28015}
  ]
})
var r = new Dash()

exports.namechange = function (user) {
  return new Promise(function (resolve, reject) {
    getDatabaseDocument(user).then((d) => {
      d.names.push(user.username)
      r.db('Discord').table('Users').update(d).run().then(() => {
        resolve()
      }).catch((e) => {
        reject(e)
      })
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
    r.db('Discord').table('Users').get(user.id).then((i) => {
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

