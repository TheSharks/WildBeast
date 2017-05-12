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
      '[Available commands]\n'
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
    var misc = [
      'If you want more information on the commands, check the command reference at http://docs.thesharks.xyz/commands.',
      'For further questions, join our server: discord.gg/wildbot',
      'Like what we do? Consider supporting my developer at Patreon! <https://www.patreon.com/Dougley>'
    ]
    msg.author.openDM().then((y) => {
      if (!msg.isPrivate) {
        msg.channel.sendMessage('Help is underway ' + msg.author.mention + '!')
      }
      for (var r in sorts) {
        y.sendMessage(`\`\`\`ini\n${sorts[r].sort().join('\n')}\n\`\`\``) // FIXME: The entire commands array should sort instead of the sorts one
      }
      y.sendMessage(misc.join('\n'))
    }).catch((e) => {
      Logger.error(e)
      msg.channel.sendMessage('Well, this is awkward, something went wrong while trying to PM you. Do you have them enabled on this server?')
    })
  } else if (suffix) {
    if (commands[suffix] || alias[suffix]) {
      var c = (commands[suffix]) ? commands[suffix] : alias[suffix]
      var attributes = []
      var name
      for (var x in commands) {
        if (commands[x] === c) {
          name = x
          break
        }
      }
      var def = [
        `Command name: \`${name}\``,
        `What this does: \`${c.help}\``,
        'Example:',
        '```',
        `${(c.usage) ? config.settings.prefix + name + ' ' + c.usage : config.settings.prefix + name}`,
        '```',
        `**Required access level**: ${c.level}`,
        `${(c.aliases) ? '**Aliases for this command**: ' + c.aliases.join(', ') + '\n' : ''}`
      ]
      for (var attribute in c) {
        switch (attribute) {
          case 'noDM': {
            if (c[attribute] === true) attributes.push('*This command cannot be used in DMs.*')
            break
          }
          case 'hidden': {
            if (c[attribute] === true) attributes.push('*This is a hidden command.*')
            break
          }
          case 'nsfw': {
            if (c[attribute] === true) attributes.push('*This command is NSFW*')
            break
          }
          case 'timeout': {
            attributes.push(`*This command has a timeout of ${c.timeout} seconds*`)
            break
          }
        }
      }
      if (name === 'meme') {
        var str = '\n**Currently available memes:\n**'
        var meme = require('./commands/memes.json')
        for (var m in meme) {
          str += m + ', '
        }
        attributes.push(str)
      }
      msg.author.openDM().then((y) => {
        y.sendMessage(def.join('\n') + attributes.join('\n'))
      })
    } else {
      msg.channel.sendMessage(`There is no **${suffix}** command!`)
    }
  }
}

exports.Commands = commands
exports.Aliases = alias
