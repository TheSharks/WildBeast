'use strict'
var directory = require('require-directory')
var com = directory(module, './commands', {
  exclude: /custom/
})
var cus = directory(module, './commands/custom')
var Logger = require('./internal/logger.js').Logger
var commands = []
var alias = []

for (var d in com) {
  for (var o in com[d].Commands) {
    commands[o] = com[d].Commands[o]
    if (com[d].Commands[o].aliases !== undefined) {
      for (var u in com[d].Commands[o].aliases) {
        alias[com[d].Commands[o].aliases[u]] = com[d].Commands[o]
      }
    }
  }
}

if (cus !== null) {
  for (var g in cus) {
    for (var l in cus[g].Commands) {
      if (commands[l]) {
        throw new Error('Custom commands cannot have the same name as default commands!')
      }
      commands[l] = cus[g].Commands[l]
      if (cus[g].Commands[l].aliases !== undefined) {
        for (var e in cus[g].Commands[l].aliases) {
          if (alias[cus[g].Commands[l].aliases[e]]) {
            throw new Error('Custom commands cannot share aliases with other commands!')
          }
          alias[cus[g].Commands[l].aliases[e]] = cus[g].Commands[l]
        }
      }
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
    msg.author.openDM().then((y) => {
      y.sendMessage(msgArray.join('\n'))
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
