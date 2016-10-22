var Config = require('../../config.json')
var Dash = require('rethinkdbdash')
var r = new Dash({
  servers: [{
    host: Config.database.host,
    port: Config.database.port
  }]
})

exports.create = function () {
  r.dbCreate('Discord')
  r.db('Discord').tableCreate('Guilds')
  r.db('Discord').tableCreate('Tags')
  r.db('Discord').tableCreate('Users')
}
