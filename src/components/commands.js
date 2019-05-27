/**
 * Index all commands
 * The name of the file will be used as the command name
 * Commands can be multiple directories deep
 * @type {Object}
 */

const glob = require('glob')
const events = glob.sync('src/commands/**/*.js')
const Command = require('../classes/Command')
const path = require('path')
const indexed = events.map(x => x.split('/').splice(2)[0])
const final = {
  commands: {},
  aliases: new Map()
}

indexed.forEach(x => {
  /* eslint-disable no-throw-literal */
  try {
    let cmd = require(`${process.cwd()}/src/commands/${x}`)
    let basename = path.basename(x, '.js')
    if (!(cmd instanceof Command)) throw `Command ${basename} is not a WildBeast command, skipping`
    if (final.commands[basename]) throw `Can't index command ${basename}, this command is duplicated, skipping`
    if (cmd.aliases && Array.isArray(cmd.aliases)) {
      cmd.aliases.forEach(x => {
        if (final.commands[x]) throw `Can't use ${x} as an alias, there's a command with this name, skipping`
        if (final.aliases.has(x)) throw `Can't set ${x} as an alias of ${basename}, this alias already exists, skipping`
        final.aliases.set(x, basename)
      })
    }
    final.commands[basename] = cmd
  } catch (e) {
    logger.error('COMMANDS', e)
  }
})

logger.trace('COMMANDS', final)
module.exports = final
