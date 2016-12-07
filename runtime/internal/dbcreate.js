var Config
try {
  Config = require('../../config.json')
} catch (e) {
  console.log('\nWildBeast encountered an error while trying to load the config file, please resolve this issue and restart the bot\n\n' + e.message)
  process.exit()
}
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

r.db('Discord').table('Guilds').then(() => {
  console.log('Database Discord exists, checking for tables...')
  checkGuilds().then((e) => {
    console.log(e)
    checkTags().then((e) => {
      console.log(e)
      checkUsers().then((e) => {
        console.log(e)
        drainAndExit()
      }).catch(e => {
        console.error(e)
      })
    }).catch(e => {
      console.error(e)
    })
  }).catch(e => {
    console.error(e)
  })
}).catch(e => {
  if (e.msg === 'None of the pools have an opened connection and failed to open a new one') {
    console.error('Could not connect to the RethinkDB instance, make sure it is running!')
    process.exit()
  } else if (e.msg === 'Database `Discord` does not exist.') {
    console.log('Creating database and tables, this may take a little while.')
    r.dbCreate('Discord').run().then(() => {
      checkGuilds().then((e) => {
        console.log(e)
        checkTags().then((e) => {
          console.log(e)
          checkUsers().then((e) => {
            console.log(e)
            drainAndExit()
          }).catch(e => {
            console.error(e)
            drainAndExit()
          })
        }).catch(e => {
          console.error(e)
          drainAndExit()
        })
      }).catch(e => {
        console.error(e)
        drainAndExit()
      })
    }).catch(e => {
      console.error(e)
      drainAndExit()
    })
  } else {
    console.error(e)
    process.exit()
  }
})

function checkGuilds () {
  return new Promise(function (resolve, reject) {
    r.db('Discord').tableCreate('Guilds').run().then(() => {
      resolve('Table Guilds has been created')
    }).catch(e => {
      if (e.msg === 'Table `Discord.Guilds` already exists.') {
        resolve('The table Guilds already exists.')
      } else {
        reject(e)
      }
    })
  })
}
function checkTags () {
  return new Promise(function (resolve, reject) {
    r.db('Discord').tableCreate('Tags').run().then(() => {
      resolve('Table Tags has been created')
    }).catch(e => {
      if (e.msg === 'Table `Discord.Tags` already exists.') {
        resolve('The table Tags already exists.')
      } else {
        reject(e)
      }
    })
  })
}

function checkUsers () {
  return new Promise(function (resolve, reject) {
    r.db('Discord').tableCreate('Users').run().then(() => {
      resolve('Table Users has been created')
    }).catch(e => {
      if (e.msg === 'Table `Discord.Users` already exists.') {
        resolve('The table Users already exists.')
      } else {
        reject(e)
      }
    })
  })
}

function drainAndExit () {
  r.getPoolMaster().drain().then(() => {
    process.exit()
  })
}
