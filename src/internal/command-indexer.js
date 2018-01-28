const commands = require('./directory-loader')('./src/commands')

let result = {}

for (let cmd in commands) {
  result[cmd] = commands[cmd]
  for (let x of commands[cmd].meta.alias) {
    result[x] = commands[cmd]
  }
}

module.exports = result
