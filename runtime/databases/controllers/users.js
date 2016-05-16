'use strict'
var Db = require('nedb')
var database = new Db({
  filename: './runtime/databases/users',
  autoload: true
})

exports.namechange = function (user) {
  return new Promise(function (resolve, reject) {
    database.find({
      _id: user.id
    }, function (err, docs) {
      if (err) {
        reject(err)
      } else if (docs) {
        if (docs.length <= 0) {
          initialize(user)
          return reject('No database!')
        } else {
          database.update({
            _id: user.id
          }, {
            $push: {
              names: user.username
            }
          }, {}, function (err) {
            if (err) {
              return reject(err)
            } else {
              return resolve(true)
            }
          })
        }
      }
    })
  })
}

exports.names = function (user) {
  return new Promise(function (resolve, reject) {
    database.find({
      _id: user.id
    }, function (err, docs) {
      if (err) {
        reject(err)
      } else if (docs) {
        try {
          return resolve(docs[0].names)
        } catch (e) {
          return reject(e)
        }
      }
    })
  })
}

exports.isKnown = function (user) {
  return new Promise(function (resolve, reject) {
    database.find({
      _id: user.id
    }, function (err, docs) {
      if (err) {
        reject(err)
      } else if (docs) {
        if (docs.length <= 0) {
          initialize(user).then((r) => {
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

function initialize (user) {
  return new Promise(function (resolve, reject) {
    var doc = {
      _id: user.id,
      names: [user.username],
      blacklisted: false
    }
    database.insert(doc, function (err, doc) {
      if (err) {
        reject(err)
      } else if (doc) {
        resolve(doc)
      }
    })
  })
}
