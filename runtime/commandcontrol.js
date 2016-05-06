'use strict'
var directory = require('require-directory')
var com = directory(module, './commands', {
  exclude: /custom/
})
var cus = directory(module, './commands/custom')
var Logger = require('./internal/logger.js').Logger
var commands = []
var alias = []

for (var i in com) {
  for (var c in com[i].Commands) {
    commands[c] = com[i].Commands[c]
    alias[c] = com[i].Commands[c].aliases
  }
}
if (cus !== null) {
  for (var j in cus) {
    for (var f in cus[j].Commands) {
      if (commands[f]) {
        throw new Error('Custom commands cannot have the same name as default commands!')
      }
      commands[f] = cus[j].Commands[f]
      alias[j] = cus[j].Commands[f].aliases
    }
  }
}

exports.helpHandle = function (msg, suffix) {
  var msgArray = []
  var commandnames = []
  if (!suffix) {
    for (var index in commands) {
      commandnames.push(commands[index].name)
    }
    msgArray.push('**Available commands:** \n')
    msgArray.push(commandnames.sort().join(', ') + '\n')
    msgArray.push('For questions: https://discord.gg/0cFoiR5QVh5LZlQO')
    if (!msg.isPrivate) {
      msg.channel.sendMessage('Help is underway ' + msg.author.mention + '!')
    }
    msg.author.openDM().then((c) => {
      c.sendMessage(msgArray.join('\n'))
    }).catch((e) => {
      Logger.error(e)
      msg.channel.sendMessage('Whoops, try again.')
    })
  } else if (suffix) {
    msgArray = []
  }
}

exports.Commands = commands
exports.Aliases = alias
