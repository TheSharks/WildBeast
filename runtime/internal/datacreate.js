var Config = require('../../config.json')
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

exports.check = function() {
  r.db('Discord').table('Guilds').then(() => {
    return
  }).catch((e) => {
    if (e.name === 'ReqlOpFailedError') {
      create()
    }
  })
}

function create () {
  r.dbCreate('Discord').run()
  r.db('Discord').tableCreate('Guilds').run()
  r.db('Discord').tableCreate('Tags').run()
  r.db('Discord').tableCreate('Users').run()
}
