'use strict'
var directory = require('require-directory')
var bugsnag = require('bugsnag')
var config = require('../config.json')
bugsnag.register(config.api_keys.bugsnag)
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
        if (alias[com[d].Commands[o].aliases[u]] && typeof alias[com[d].Commands[o].aliases[u]] !== 'function') {
          throw new Error('Aliases cannot be shared between commands!')
        }
        alias[com[d].Commands[o].aliases[u]] = com[d].Commands[o]
      }
    }
  }
}

if (cus !== null) {
  for (var g in cus) {
    for (var l in cus[g].Commands) {
      if (commands[l] && !cus[g].Commands[l].overwrite && typeof commands[l] !== 'function') {
        throw new Error('Custom commands cannot replace default commands without overwrite enabled!')
      }
      commands[l] = cus[g].Commands[l]
      if (cus[g].Commands[l].aliases !== undefined) {
        for (var e in cus[g].Commands[l].aliases) {
          if (alias[cus[g].Commands[l].aliases[e]] && typeof alias[cus[g].Commands[l].aliases[e]] !== 'function') {
            throw new Error('Aliases cannot be shared between commands!')
          }
          alias[cus[g].Commands[l].aliases[e]] = cus[g].Commands[l]
        }
      }
    }
  }
}

exports.helpHandle = function (msg, suffix) {
  var sorts = {
    0: [
      '**Available commands:**\n'
    ]
  }
  let counter = 0
  if (!suffix) {
    for (var index in commands) {
      if (!commands[index].hidden && commands[index].level !== 'master') {
        if (sorts[counter].join('\n').length > 1750) {
          counter++
          sorts[counter] = []
        }
        sorts[counter].push(index + ' = "' + commands[index].help + '"')
      }
    }
    msg.author.openDM().then((y) => {
      if (!msg.isPrivate) {
        msg.channel.sendMessage('Help is underway ' + msg.author.mention + '!')
      }
      for (var r of sorts) {
        y.sendMessage(`\`\`\`ini\n${r.join('\n')}\n\`\`\``)
      }
    }).catch((e) => {
      Logger.error(e)
      msg.channel.sendMessage('Well, this is awkward, something went wrong while trying to PM you. Do you have them enabled on this server?')
    })
  } else if (suffix) {
    if (commands[suffix] || alias[suffix]) {
      var attributes = []
      var c = (commands[suffix]) ? commands[suffix] : alias[suffix]
      for (var attribute of c) {
        switch (attribute) {
          case 'level': {
            // yadda yadda you get the point
          }
        }
      }
    } else {
      msg.channel.sendMessage(`There is no **${suffix}** command!`)
    }
  }
}

exports.Commands = commands
exports.Aliases = alias
