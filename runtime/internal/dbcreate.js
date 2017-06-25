let Config
try {
  Config = require('../../config.json')
} catch (e) {
  console.log('\nEncountered an error while trying to load the config file, please resolve this issue run the last command again.\n\n' + e.message)
  process.exit()
}
let Dash = require('rethinkdbdash')
let r = new Dash({
  user: Config.database.user,
  password: Config.database.password,
  silent: true,
  servers: [{
    host: Config.database.host,
    port: Config.database.port
  }]
})

let tables = ['Guilds', 'Tags', 'Users']

r.db('Discord').tableList().then((list) => {
  console.log(`Database Discord exists, checking for tables...`)
  if (tables.some(table => list.includes(table)) || tables.some(table => !list.includes(table))) {
    loop(tables[0])
  }
}).catch(e => {
  if (e.msg === 'None of the pools have an opened connection and failed to open a new one') {
    console.error('Could not connect to the RethinkDB instance, make sure it is running!')
    process.exit(1)
  } else if (e.msg === `Database \`Discord\` does not exist.`) {
    console.log('Creating database and tables, this may take a little while.')
    r.dbCreate('Discord').run().then(() => {
      loop(tables[0])
    }).catch(e => {
      console.error(e)
      drainAndExit(1)
    })
  } else {
    console.error(e)
    process.exit(1)
  }
})

function loop (t) {
  if (tables.length > 0) {
    checkTable(t).then((e) => {
      console.log(e)
      tables.shift()
      loop(tables[0])
    }).catch((err) => {
      console.error(err)
      drainAndExit(1)
    })
  } else {
    process.exit(0)
  }
}

function checkTable (table) {
  return new Promise(function (resolve, reject) {
    r.db('Discord').tableCreate(table).run().then(() => {
      resolve(`The table ${table} has been created`)
    }).catch(e => {
      if (e.msg === `Table \`Discord.${table}\` already exists.`) {
        resolve(`The table ${table} already exists.`)
      } else {
        reject(e)
      }
    })
  })
}

function drainAndExit (exitCode) {
  r.getPoolMaster().drain().then(() => {
    process.exit(exitCode)
  })
}
