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
  var msgArraytwo = []
  var cmdone = []
  if (!suffix) {
    for (var index in commands) {
      if (commands[index].hidden) {
        continue
      } else {
        cmdone.push(commands[index].name + ' - ' + commands[index].help)
      }
    }
  var cmdtwo = cmdone.splice(0, cmdone.length / 2)
    msgArray.push('**Available commands:** \n')
    msgArray.push('```xl')
    msgArray.push(commandnames.sort().join('\n') + '\n')
    msgArray.push('```')
    msgArraytwo.push('```xl')
    msgArraytwo.push(cmdtwo.sort().join('\n') + '\n')
    msgArraytwo.push('For questions: https://discord.gg/0cFoiR5QVh5LZlQO')
    msgArraytwo.push('```')
    if (!msg.isPrivate) {
      msg.channel.sendMessage('Help is underway ' + msg.author.mention + '!')
    }
    msg.author.openDM().then((y) => {
      y.sendMessage(msgArray.join('\n'))
      y.sendMessage(msgArraytwo.join('\n'))
    }).catch((e) => {
      Logger.error(e)
      msg.channel.sendMessage('Whoops, try again.')
    })
  } else if (suffix) {
    if (commands[suffix] || alias[suffix]) {
      var comad
      if (alias[suffix]) {
        comad = alias[suffix]
      } else {
        comad = commands[suffix]
      }
      msgArray = []
      msgArray.push('Command name `' + comad.name + '`')
      msgArray.push('What this does: `' + comad.help + '`\n')
      msgArray.push('Example:')
      if (comad.hasOwnProperty('usage')) {
        msgArray.push('```' + `${require('../config.json').settings.prefix}${comad.name} ${comad.usage}` + '```')
      } else {
        msgArray.push('```' + `${require('../config.json').settings.prefix}${comad.name}` + '```')
      }
      msgArray.push(`**Required access level**: ${comad.level}`)
      if (comad.hasOwnProperty('aliases')) {
        msgArray.push(`**Aliases for this command**: ${comad.aliases.join(', ')}.`)
      }
      if (comad.hasOwnProperty('hidden')) {
        msgArray.push('*Shh, this is a secret command.*')
      }
      if (comad.hasOwnProperty('timeout')) {
        msgArray.push(`*This command has a timeout of ${comad.timeout} seconds.*`)
      }
      if (comad.hasOwnProperty('nsfw')) {
        msgArray.push('*This command is NSFW.*')
      }
      if (comad.hasOwnProperty('noDM')) {
        msgArray.push('*This command cannot be used in DM.*')
      }
      if (comad.name === 'meme') {
        var str = '**Currently available memes:\n**'
        var meme = require('./commands/memes.json')
        for (var m in meme) {
          str += m + ', '
        }
        msgArray.push(str.substring(0, str.length - 2))
      }
      msg.author.openDM().then((y) => {
        y.sendMessage(msgArray.join('\n'))
      }).catch((e) => {
        Logger.error(e)
        msg.channel.sendMessage('Whoops, try again.')
      })
    } else {
      msg.channel.sendMessage(`There is no **${suffix}** command!`)
    }
  }
}

exports.Commands = commands
exports.Aliases = alias
