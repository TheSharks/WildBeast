var Commands = []
var request = require('request')
var config = require('../../config.json')
var Logger = require('../internal/logger.js').Logger
var argv = require('minimist')(process.argv.slice(2))
var bugsnag = require('bugsnag')
bugsnag.register(config.api_keys.bugsnag)

function getUptime () {
  var d = Math.floor(process.uptime() / 86400)
  var hrs = Math.floor((process.uptime() % 86400) / 3600)
  var min = Math.floor(((process.uptime() % 86400) % 3600) / 60)
  var sec = Math.floor(((process.uptime() % 86400) % 3600) % 60)

  if (d === 0 && hrs !== 0) {
    return `${hrs} hrs, ${min} mins, ${sec} seconds`
  } else if (d === 0 && hrs === 0 && min !== 0) {
    return `${min} mins, ${sec} seconds`
  } else if (d === 0 && hrs === 0 && min === 0) {
    return `${sec} seconds`
  } else {
    return `${d} days, ${hrs} hrs, ${min} mins, ${sec} seconds`
  }
}

Commands.ping = {
  name: 'ping',
  help: "I'll reply to you with pong!",
  timeout: 10,
  level: 0,
  fn: function (msg) {
    var initTime = new Date(msg.timestamp)
    msg.reply('Pong!').then((m) => {
      m.edit('<@' + msg.author.id + '>, Pong! Time taken: ' + Math.floor(new Date(m.timestamp) - initTime) + ' ms.')
    })
  }
}

Commands.say = {
  name: 'say',
  help: 'Repeat after me.',
  aliases: ['echo', 'repeat'],
  timeout: 10,
  level: 0,
  fn: function (msg, suffix) {
    if (!suffix) {
      msg.reply('Cannot send an empty message, ya doof.')
      return
    }
    var re = /(discord(\.gg|app\.com\/invite)\/([\w]{16}|([\w]+-?){3}))/
    if (msg.mentions.length >= 5) {
      msg.reply('No more than five mentions at a time please.')
    } else if (re.test(msg.content)) {
      msg.reply('Lol no thanks, not sending that.')
    } else {
      msg.channel.sendMessage('\u200B' + suffix.replace(/@everyone/, '@\u200Beveryone').replace(/@here/, '@\u200Bhere'))
    }
  }
}

Commands.purge = {
  name: 'purge',
  help: 'Use this command to delete any amount of message up to 100.',
  usage: '<number>',
  aliases: ['prune'],
  noDM: true,
  timeout: 30,
  level: 0,
  fn: function (msg, suffix, bot) {
    var guild = msg.guild
    var user = msg.author
    var userPerms = user.permissionsFor(guild)
    var botPerms = bot.User.permissionsFor(guild)
    if (!userPerms.Text.MANAGE_MESSAGES) {
      msg.reply('You do not have the permission to manage messages!')
    } else if (!botPerms.Text.MANAGE_MESSAGES) {
      msg.reply('I do not have `Manage Messages` permission!')
    } else {
      if (!suffix || isNaN(suffix) || suffix > 100 || suffix < 0) {
        msg.reply('Please try again with a number between **0** to **100**.')
      } else {
        msg.channel.fetchMessages(suffix).then((result) => {
          bot.Messages.deleteMessages(result.messages)
        }).catch((error) => {
          msg.channel.sendMessage('I could not fetch messages to delete, try again later.')
          Logger.error(error)
        })
      }
    }
  }
}

Commands.eval = {
  name: 'eval',
  help: 'Allows for the execution of arbitrary Javascript.',
  level: 'master',
  fn: function (msg, suffix, bot) {
    if (msg.author.id === bot.User.id) return // To statisfy our styleguide :P
    var util = require('util')
    try {
      var returned = eval(suffix)
      var str = util.inspect(returned, {
        depth: 1
      })
      if (str.length > 1900) {
        str = str.substr(0, 1897)
        str = str + '...'
      }
      str = str.replace(new RegExp(bot.token, 'gi'), '( ͡° ͜ʖ ͡°)') // Because some frog broke this string with a shruglenny
      msg.channel.sendMessage('```xl\n' + str + '\n```').then((ms) => {
        if (returned !== undefined && returned !== null && typeof returned.then === 'function') {
          returned.then(() => {
            var str = util.inspect(returned, {
              depth: 1
            })
            if (str.length > 1900) {
              str = str.substr(0, 1897)
              str = str + '...'
            }
            ms.edit('```xl\n' + str + '\n```')
          }, (e) => {
            var str = util.inspect(e, {
              depth: 1
            })
            if (str.length > 1900) {
              str = str.substr(0, 1897)
              str = str + '...'
            }
            ms.edit('```xl\n' + str + '\n```')
          })
        }
      })
    } catch (e) {
      msg.channel.sendMessage('```xl\n' + e + '\n```')
    }
  }
}

Commands.plaineval = {
  name: 'plaineval',
  help: 'Allows for the execution of arbitrary Javascript.',
  level: 'master',
  fn: function (msg, suffix, bot) {
    if (msg.author.id === bot.User.id) return // To statisfy our styleguide :P
    var evalfin = []
    try {
      evalfin.push('```xl')
      evalfin.push(eval(suffix))
      evalfin.push('```')
    } catch (e) {
      evalfin = []
      evalfin.push('```xl')
      evalfin.push(e)
      evalfin.push('```')
    }
    msg.channel.sendMessage(evalfin.join('\n'))
  }
}

Commands.twitch = {
  name: 'twitch',
  help: 'Tells you if a specified streamer is live on Twitch.tv',
  level: 0,
  fn: function (msg, suffix) {
    if (!suffix) {
      msg.channel.sendMessage('No channel specified!')
      return
    }
    var url = 'https://api.twitch.tv/kraken/streams/' + suffix
    request({
      url: url,
      headers: {
        'Accept': 'application/vnd.twitchtv.v3+json',
        'Client-ID': config.api_keys.twitchId
      }
    }, function (error, response, body) {
      if (error) {
        bugsnag.notify(error)
      }
      if (!error && response.statusCode === 200) {
        var resp
        try {
          resp = JSON.parse(body)
        } catch (e) {
          msg.channel.sendMessage('The API returned an unconventional response.')
        }
        if (resp.stream !== null) {
          msg.channel.sendMessage(suffix + ' is currently live at https://www.twitch.tv/' + suffix)
          return
        } else if (resp.stream === null) {
          msg.channel.sendMessage(suffix + ' is not currently streaming')
          return
        }
      } else if (!error && response.statusCode === 404) {
        msg.channel.sendMessage('Channel does not exist!')
        return
      }
    })
  }
}

Commands.customize = {
  name: 'customize',
  help: 'Adjust my behaviour in this server!',
  noDM: true,
  level: 3,
  fn: function (msg, suffix) {
    var c = require('../databases/controllers/customize.js')
    suffix = suffix.split(' ')
    var x = suffix.slice(1, suffix.length).join(' ')
    if (suffix[0] === 'help') {
      c.helpHandle(msg)
    } else {
      c.adjust(msg, suffix[0], x).then((r) => {
        msg.channel.sendMessage(':ok_hand: Adjusted ' + suffix[0] + ' to `' + r + '`')
      }).catch((e) => {
        msg.channel.sendMessage('Whoops, ' + e)
      })
    }
  }
}

Commands.info = {
  name: 'info',
  help: "I'll print some information about me.",
  timeout: 10,
  level: 0,
  fn: function (msg, suffix, bot) {
    var owner
    try {
      owner = `${bot.Users.get(config.permissions.master[0]).username}#${bot.Users.get(config.permissions.master[0]).discriminator}`
    } catch (e) {
      owner = `'ID: ${config.permissions.master[0]}`
    }
    var field = [{name: 'Servers Connected', value: '```fix`\n' + bot.Guilds.length + '```', inline: true},
        {name: 'Users Known', value: '```fix`\n' + bot.Users.length + '```', inline: true},
        {name: 'Channels Connected', value: '```fix`\n' + bot.Channels.length + '```', inline: true},
        {name: 'Private Channels', value: '```fix`\n' + bot.DirectMessageChannels.length + '```', inline: true},
        {name: 'Messages Received', value: '```fix`\n' + bot.Messages.length + '```', inline: true},
        {name: 'Owner', value: '```\n' + owner + '```', inline: true},
        {name: 'Sharded?', value: '```\n' + `${argv.shardmode ? 'Yes' : 'No'}` + '```', inline: true}]
    if (argv.shardmode) {
      field.push({name: 'Shard ID', value: '```\n' + argv.shardid + '```', inline: true})
      field.push({name: 'Shard Count', value: '```\n' + argv.shardcount + '```', inline: true})
    }
    msg.channel.sendMessage('', false, {
      color: 0x3498db,
      author: {icon_url: bot.User.avatarURL, name: `${bot.User.username}#${bot.User.discriminator} (${bot.User.id})`},
      title: `Running on WildBeast version ${require('../../package.json').version}`,
      timestamp: new Date(),
      fields: field,
      description: '*My developer is Dougley#6248*',
      url: 'https://github.com/TheSharks/WildBeast',
      footer: {text: `Online for ${getUptime()}`}
    })
  }
}

Commands['leave-server'] = {
  name: 'leave-server',
  help: "I'll leave this server if I am not welcome here.",
  noDM: true,
  level: 3,
  fn: function (msg) {
    if (msg.isPrivate) {
      msg.channel.sendMessage('You can not do this in a DM!')
    } else {
      msg.channel.sendMessage('Okay, cya!')
      msg.guild.leave()
    }
  }
}

Commands.killswitch = {
  name: 'killswitch',
  help: 'This will instantly terminate all running bot processes',
  level: 'master',
  fn: function (msg, suffix, bot) {
    bot.disconnect()
    Logger.warn('Disconnected via killswitch!')
    process.exit(0)
  }
}

Commands.namechanges = {
  name: 'namechanges',
  help: 'I will tell you the name changes for the user you mention.',
  noDM: true,
  level: 0,
  fn: function (msg) {
    const n = require('../databases/controllers/users.js')
    if (msg.mentions.length === 0) {
      msg.channel.sendMessage('Please mention the user you want the name changes of.')
      return
    }
    msg.mentions.map((u) => {
      n.names(u).then((n) => {
        msg.channel.sendMessage(n.join(', '))
      })
    })
  }
}

Commands.setlevel = {
  name: 'setlevel',
  help: 'This changes the permission level of a user.',
  noDM: true,
  level: 3,
  fn: function (msg, suffix, bot) {
    var Permissions = require('../databases/controllers/permissions.js')
    suffix = suffix.split(' ')
    if (isNaN(suffix[0])) {
      msg.reply('Your first parameter is not a number!')
    } else if (suffix[0] > 3) {
      msg.channel.sendMessage('Setting a level higher than 3 is not allowed.')
    } else if (msg.mentions.length === 0 && msg.mention_roles.length === 0 && !msg.mention_everyone) {
      msg.reply('Please @mention the user(s)/role(s) you want to set the permission level of.')
    } else if (msg.mentions.length === 1 && msg.mentions[0].id === bot.User.id) {
      msg.reply("I don't need any level set, I can do anything regardless of access levels.")
    } else {
      Permissions.adjustLevel(msg, msg.mentions, parseFloat(suffix[0]), msg.mention_roles).then(function () {
        msg.channel.sendMessage('Alright! The permission levels have been set successfully!')
      }).catch(function (err) {
        msg.channel.sendMessage('Help! Something went wrong!')
        bugsnag.notify(err)
        Logger.error(err)
      })
    }
  }
}

Commands.setnsfw = {
  name: 'setnsfw',
  help: 'This changes if the channel allows NSFW commands.',
  noDM: true,
  usage: '<on | off>',
  level: 3,
  fn: function (msg, suffix) {
    var Permissions = require('../databases/controllers/permissions.js')
    if (msg.guild) {
      if (suffix === 'on' || suffix === 'off') {
        Permissions.adjustNSFW(msg, suffix).then((allow) => {
          if (allow) {
            msg.channel.sendMessage('NSFW commands are now allowed for ' + msg.channel.mention)
          } else if (!allow) {
            msg.channel.sendMessage('NSFW commands are now disallowed for ' + msg.channel.mention)
          }
        }).catch(() => {
          msg.reply("I've failed to set NSFW flag!")
        })
      } else {
        msg.channel.sendMessage('Use either `on` or `off` as suffix!')
      }
    } else {
      msg.channel.sendMessage("NSFW commands are always allowed in DM's.")
    }
  }
}

Commands.hello = {
  name: 'hello',
  help: "I'll respond to you with hello along with a GitHub link!",
  timeout: 20,
  level: 0,
  fn: function (msg, suffix, bot) {
    msg.channel.sendMessage('Hi ' + msg.author.username + ", I'm " + bot.User.username + ' and I was developed by the team over at TheSharks! Improve me by contributing to my source code on GitHub: https://github.com/TheSharks/WildBeast')
  }
}

Commands.setstatus = {
  name: 'setstatus',
  help: 'This will change my current status to something else.',
  usage: '<online / idle / twitch url> [playing status]',
  level: 'master',
  fn: function (msg, suffix, bot) {
    var first = suffix.split(' ')
    if (/^http/.test(first[0])) {
      bot.User.setStatus(null, {
        type: 1,
        name: suffix.substring(first[0].length + 1),
        url: first[0]
      })
      msg.channel.sendMessage(`Set status to streaming with message ${suffix.substring(first[0].length + 1)}`)
    } else {
      if (['online', 'idle'].indexOf(first[0]) > -1) {
        bot.User.setStatus(first[0], {
          name: suffix.substring(first[0].length + 1)
        })
        msg.channel.sendMessage(`Set status to ${first[0]} with message ${suffix.substring(first[0].length + 1)}`)
      } else {
        msg.reply('Can only be `online` or `idle`')
      }
    }
  }
}

Commands['server-info'] = {
  name: 'server-info',
  help: "I'll tell you some information about the server you're currently in.",
  aliases: ['serverinfo'],
  noDM: true,
  timeout: 20,
  level: 0,
  fn: function (msg, suffix, bot) {
    // if we're not in a PM, return some info about the channel
    if (msg.guild) {
      var field = [{name: 'Server name', value: `${msg.guild.name} (${msg.guild.acronym})`},
      {name: 'Owned by', value: '```fix`\n' + `${msg.guild.owner.username}#${msg.guild.owner.discriminator} (${msg.guild.owner.id})` + '```', inline: true},
      {name: 'Current Region', value: '```fix`\n' + msg.guild.region + '```', inline: true},
      {name: 'Members', value: '```fix`\n' + msg.guild.members.length + '```', inline: true},
      {name: 'Text Channels', value: '```fix`\n' + msg.guild.textChannels.length + '```', inline: true},
      {name: 'Voice Channels', value: '```fix`\n' + msg.guild.voiceChannels.length + '```', inline: true},
      {name: 'Total Roles', value: '```fix`\n' + msg.guild.roles.length + '```', inline: true}]

      if (msg.guild.afk_channel === null) {
        field.push({name: 'AFK-Channel', value: '```fix`\nNone```'})
      } else {
        field.push({name: 'AFK-channel', value: '```fix`\n' + `${msg.guild.afk_channel.name} (${msg.guild.afk_channel.id})` + '```'})
      }
      var embed = {
        author: {name: `Information requested by ${msg.author.username}`},
        timestamp: new Date(),
        color: 0x3498db,
        fields: field,
        footer: {text: `Online for ${getUptime()}`, icon_url: bot.User.avatarURL}
      }
      if (msg.guild.icon) {
        embed.thumbnail = {url: msg.guild.iconURL}
        embed.url = msg.guild.iconURL
      }
      msg.channel.sendMessage('', false, embed)
    } else {
      msg.channel.sendMessage("You can't do that in a DM, dummy!.")
    }
  }
}

Commands.userinfo = {
  name: 'userinfo',
  help: "I'll get some information about the user you've mentioned.",
  noDM: true,
  level: 0,
  fn: function (msg, suffix, bot) {
    var Permissions = require('../databases/controllers/permissions.js')
    if (msg.isPrivate) {
      msg.channel.sendMessage("Sorry you can't use this in DMs")
    }
    if (msg.mentions.length === 0) {
      Permissions.checkLevel(msg, msg.author.id, msg.member.roles).then((level) => {
        var tempRoles = msg.member.roles.sort(function (a, b) { return a.position - b.position }).reverse()
        var roles = []
        for (var i in tempRoles) {
          roles.push(tempRoles[i].name)
        }
        roles = roles.splice(0, roles.length).join(', ')
        var field = [
          {name: 'Status', value: '```fix`\n' + msg.author.status + '```', inline: true},
          {name: 'Account Creation', value: '```fix`\n' + msg.author.createdAt + '```'},
          {name: 'Access Level', value: '```fix`\n' + level + '```'},
          {name: 'Roles', value: '```fix`\n' + `${tempRoles.length > 0 ? roles : 'None'}` + '```'}]
        if (msg.author.gameName) {
          field.splice(1, 0, {name: 'Playing', value: '```fix`\n' + msg.author.gameName + '```', inline: true})
        }
        var embed = {
          author: {name: `${msg.author.username}#${msg.author.discriminator} (${msg.author.id})`},
          timestamp: new Date(),
          fields: field,
          footer: {text: `Online for ${getUptime()}`, icon_url: bot.User.avatarURL}
        }
        if (msg.author.avatarURL) {
          embed.author.icon_url = msg.author.avatarURL
          embed.thumbnail = {url: msg.author.avatarURL}
          embed.url = msg.author.avatarURL
        }
        msg.channel.sendMessage('', false, embed)
      }).catch((error) => {
        msg.channel.sendMessage('Something went wrong, try again later.')
        Logger.error(error)
      })
      return
    }
    msg.mentions.map(function (user) {
      Permissions.checkLevel(msg, user.id, user.memberOf(msg.guild).roles).then(function (level) {
        var guild = msg.guild
        var member = guild.members.find((m) => m.id === user.id)
        var tempRoles = member.roles.sort(function (a, b) { return a.position - b.position }).reverse()
        var roles = []
        for (var i in tempRoles) {
          roles.push(tempRoles[i].name)
        }
        roles = roles.splice(0, roles.length).join(', ')
        var field = [
          {name: 'Status', value: '```fix`\n' + user.status + '```', inline: true},
          {name: 'Account Creation', value: '```fix`\n' + user.createdAt + '```'},
          {name: 'Access Level', value: '```fix`\n' + level + '```'},
          {name: 'Roles', value: '```fix`\n' + `${tempRoles.length > 0 ? roles : 'None'}` + '```'}]
        if (user.gameName) {
          field.splice(1, 0, {name: 'Playing', value: '```fix`\n' + user.gameName + '```', inline: true})
        }
        var embed = {
          author: {name: `${user.username}#${user.discriminator} (${user.id})`},
          timestamp: new Date(),
          fields: field,
          footer: {text: `Online for ${getUptime()}`, icon_url: bot.User.avatarURL}
        }
        if (user.avatarURL) {
          embed.author.icon_url = user.avatarURL
          embed.thumbnail = {url: user.avatarURL}
          embed.url = user.avatarURL
        }
        msg.channel.sendMessage('', false, embed)
      }).catch(function (err) {
        Logger.error(err)
        msg.channel.sendMessage('Something went wrong, try again later.')
      })
    })
  }
}

Commands['join-server'] = {
  name: 'join-server',
  help: "I'll join the server you've requested me to join, as long as the invite is valid and I'm not banned of already in the requested server.",
  aliases: ['join', 'joinserver', 'invite'],
  usage: '<bot-mention> <instant-invite>',
  level: 0,
  fn: function (msg, suffix, bot) {
    if (bot.User.bot) {
      msg.channel.sendMessage("Sorry, bot accounts can't accept instant invites, instead, use my OAuth URL: " + config.bot.oauth)
      return
    }
    var re = /(discord(\.gg|app\.com\/invite)\/([\w]{16}|([\w]+-?){3}))/
    var code = re.exec(suffix.split(' '))
    if (msg.guild && bot.User.isMentioned(msg)) {
      bot.Invites.resolve(code[3]).then(function (server) {
        if (bot.Guilds.get(server.guild.id)) {
          msg.channel.sendMessage("I'm already in **" + server.guild.name + '**')
        } else {
          bot.Invites.accept(server).then(function (server) {
            Logger.log('debug', 'Joined ' + server.guild.name + ', at the request of ' + msg.author.username)
            msg.channel.sendMessage("I've joined **" + server.guild.name + '** at your request.')
          })
        }
      }).catch(function (error) {
        Logger.warn('Invite link provided by ' + msg.author.username + ' gave us an error: ' + error)
        if (error.status === 403) {
          msg.channel.sendMessage("The server you're trying to invite me to appears to have banned me.")
        } else {
          msg.channel.sendMessage("The invite link you've provided me appears to be invalid!")
        }
      })
    } else if (msg.isPrivate) {
      bot.Invites.resolve(code[3]).then(function (server) {
        if (bot.Guilds.get(server.guild.id)) {
          msg.channel.sendMessage("I'm already in **" + server.guild.name + '**')
        } else {
          bot.Invites.accept(server).then(function (server) {
            Logger.log('debug', 'Joined ' + server.guild.name + ', at the request of ' + msg.author.username)
            msg.channel.sendMessage("I've joined **" + server.guild.name + '** at your request.')
          })
        }
      }).catch(function (error) {
        Logger.warn('Invite link provided by ' + msg.author.username + ' gave us an error: ' + error)
        if (error.status === 403) {
          msg.channel.sendMessage("The server you're trying to invite me to appears to have banned me.")
        } else {
          msg.channel.sendMessage("The invite link you've provided me appears to be invalid!")
        }
      })
    }
  }
}

Commands.kick = {
  name: 'kick',
  help: 'Kick the user(s) out of the server!',
  noDM: true,
  usage: '<user-mention>',
  level: 0,
  fn: function (msg, suffix, bot) {
    var guild = msg.guild
    var user = msg.author
    var botuser = bot.User
    var guildPerms = user.permissionsFor(guild)
    var botPerms = botuser.permissionsFor(guild)
    if (!guildPerms.General.KICK_MEMBERS) {
      msg.channel.sendMessage('Sorry, you do not have enough permissions to kick members.')
    } else if (!botPerms.General.KICK_MEMBERS) {
      msg.reply("I don't have enough permissions to do this!")
    } else if (msg.mentions.length === 0) {
      msg.channel.sendMessage('Please mention the user(s) you want to kick.')
      return
    } else {
      msg.mentions.map(function (user) {
        var member = msg.guild.members.find((m) => m.id === user.id)
        member.kick().then(() => {
          msg.channel.sendMessage('Kicked ' + user.username)
        }).catch((error) => {
          msg.channel.sendMessage('Failed to kick ' + user.username)
          Logger.error(error)
        })
      })
    }
  }
}

Commands.ban = {
  name: 'ban',
  help: 'Swing the banhammer on someone!',
  noDM: true,
  usage: '<user-mention> [days]',
  level: 0,
  fn: function (msg, suffix, bot) {
    var guild = msg.guild
    var user = msg.author
    var botuser = bot.User
    var guildPerms = user.permissionsFor(guild)
    var botPerms = botuser.permissionsFor(guild)
    if (!guildPerms.General.BAN_MEMBERS) {
      msg.reply('You do not have Ban Members permission here.')
    } else if (!botPerms.General.BAN_MEMBERS) {
      msg.channel.sendMessage('I do not have Ban Members permission, sorry!')
    } else if (msg.mentions.length === 0) {
      msg.channel.sendMessage('Please mention the user(s) you want to ban.')
    } else {
      var days = suffix.split(' ')[msg.mentions.length] || 0
      if ([0, 1, 7].indexOf(parseFloat(days)) > -1) {
        msg.mentions.map(function (user) {
          var member = msg.guild.members.find((m) => m.id === user.id)
          member.ban(days).then(() => {
            msg.channel.sendMessage("I've banned " + user.username + ' deleting ' + days + ' days of messages.')
          }).catch((error) => {
            msg.channel.sendMessage('Failed to ban ' + user.username)
            Logger.error(error)
          })
        })
      } else {
        msg.reply('Your last argument must be a number or nothing for the default of 0, can only be 0, 1 or 7!')
      }
    }
  }
}

Commands.prefix = {
  name: 'prefix',
  help: "If you, despite reading this have no clue what my prefix is, I'll tell you!",
  timeout: 5,
  level: 0,
  fn: function (msg) {
    var datacontrol = require('../datacontrol')
    datacontrol.customize.prefix(msg).then((prefix) => {
      if (prefix) {
        msg.channel.sendMessage(`My prefix on this server is ${prefix}`)
      } else {
        msg.channel.sendMessage(`My prefix is ${config.settings.prefix}`) // Default prefix, if none is set in customize
      }
    }).catch((error) => {
      Logger.error(error)
      msg.channel.sendMessage('Whoops, something went wrong.')
    })
  }
}

exports.Commands = Commands
