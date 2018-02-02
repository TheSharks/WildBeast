const commands = require('./directory-loader')('./src/commands')

let result = {}
const aliases = new Map()

for (let cmd in commands) {
  result[cmd] = commands[cmd]
  for (let x of commands[cmd].meta.alias) {
    if (commands[x]) global.logger.error(`Cannot set alias ${x}, there's a command with this name.`, true)
    if (aliases.has(x)) global.logger.error(`Cannot set ${x} as an alias of ${cmd}, it's already in use by ${aliases.get(x)}.`, true)
    aliases.set(x, cmd)
  }
}

module.exports = {
  commands: result,
  alias: aliases
}
