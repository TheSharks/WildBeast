'use strict'
process.title = 'WildBeast'

var Config

try {
  Config = require('./config.json')
} catch (e) {
  console.log('\nWildBeast encountered an error while trying to load the config file, please resolve this issue and restart WildBeast\n\n' + e.message)
  process.exit()
}

var argv = require('minimist')(process.argv.slice(2))
var Logger = require('./runtime/internal/logger.js').Logger
var Bezerk = require('./runtime/internal/bezerk.js')

var Discordie = require('discordie')
var Event = Discordie.Events
var bot
var runtime = require('./runtime/runtime.js')
var timeout = runtime.internal.timeouts
var commands = runtime.commandcontrol.Commands
var aliases = runtime.commandcontrol.Aliases
var datacontrol = runtime.datacontrol

Logger.info('Initializing...')

if (argv.shardmode && !isNaN(argv.shardid) && !isNaN(argv.shardcount)) {
  Logger.info('Starting in ShardMode, this is shard ' + argv.shardid, {
    shardInfo: [argv.shardcount, argv.shardid]
  })
  bot = new Discordie({
    shardId: argv.shardid,
    shardCount: argv.shardcount
  })
} else {
  bot = new Discordie()
}

start()

var bugsnag = require('bugsnag')
bugsnag.register(Config.api_keys.bugsnag)

bot.Dispatcher.on(Event.GATEWAY_READY, function () {
  bot.Users.fetchMembers()
  runtime.internal.versioncheck.versionCheck(function (err, res) {
    if (err) {
      Logger.error('Version check failed, ' + err)
    } else if (res) {
      Logger.info(`Version check: ${res}`)
    }
  })
  Logger.info('Ready to start!', {
    botID: bot.User.id,
    version: require('./package.json').version
  })
  Logger.info(`Logged in as ${bot.User.username}#${bot.User.discriminator} (ID: ${bot.User.id}) and serving ${bot.Users.length} users in ${bot.Guilds.length} servers.`)
  if (argv.shutdownwhenready) {
    console.log('o okei bai')
    process.exit(0)
  }
})

bot.Dispatcher.on(Event.MESSAGE_CREATE, function (c) {
  if (c.message.author.bot || c.message.author.id === bot.User.id) {
    return
  }
  if (!bot.connected) return
  datacontrol.users.isKnown(c.message.author)
  var prefix
  var loggingGuild = {}
  for (var k in c.message.guild) {
    loggingGuild[k] = c.message.guild[k]
  }
  loggingGuild.roles = []
  loggingGuild.emojis = []
  datacontrol.customize.getGuildData(c.message).then(function (g) {
    if (!g.customize.prefix) {
      prefix = Config.settings.prefix
    } else {
      prefix = g.customize.prefix
    }
    var cmd
    var suffix
    if (c.message.content.indexOf(prefix) === 0) {
      cmd = c.message.content.substr(prefix.length).split(' ')[0].toLowerCase()
      suffix = c.message.content.substr(prefix.length).split(' ')
      suffix = suffix.slice(1, suffix.length).join(' ')
    } else if (c.message.content.indexOf(bot.User.mention) === 0) {
      cmd = c.message.content.substr(bot.User.mention.length + 1).split(' ')[0].toLowerCase()
      suffix = c.message.content.substr(bot.User.mention.length).split(' ')
      suffix = suffix.slice(2, suffix.length).join(' ')
    } else if (c.message.content.indexOf(bot.User.nickMention) === 0) {
      cmd = c.message.content.substr(bot.User.nickMention.length + 1).split(' ')[0].toLowerCase()
      suffix = c.message.content.substr(bot.User.nickMention.length).split(' ')
      suffix = suffix.slice(2, suffix.length).join(' ')
    }
    if (cmd === 'help') {
      runtime.commandcontrol.helpHandle(c.message, suffix)
    }
    if (aliases[cmd]) {
      cmd = aliases[cmd].name
    }
    if (commands[cmd]) {
      if (typeof commands[cmd] !== 'object') {
        return // ignore JS build-in array functions
      }
      Logger.info(`Executing <${c.message.resolveContent()}> from ${c.message.author.username}`, {
        author: c.message.author,
        guild: loggingGuild,
        botID: bot.User.id,
        cmd: cmd
      })
      if (commands[cmd].level === 'master') {
        if (Config.permissions.master.indexOf(c.message.author.id) > -1) {
          try {
            commands[cmd].fn(c.message, suffix, bot)
          } catch (e) {
            c.message.channel.sendMessage('An error occurred while trying to process this command, you should let the bot author know. \n```' + e + '```')
            Logger.error(`Command error, thrown by ${commands[cmd].name}: ${e}`, {
              author: c.message.author,
              guild: loggingGuild,
              botID: bot.User.id,
              cmd: cmd,
              error: e
            })
          }
        } else {
          c.message.channel.sendMessage('This command is only for the bot owner.')
        }
      } else if (!c.message.isPrivate) {
        datacontrol.permissions.checkLevel(c.message, c.message.author.id, c.message.member.roles).then(r => {
          if (r !== -1) {
            timeout.check(commands[cmd], c.message.guild.id, c.message.author.id).then(t => {
              if (t !== true) {
                if (g.customize.timeout === null || g.customize.timeout === 'default') {
                  c.message.channel.sendMessage(`Wait ${Math.round(t)} more seconds before using that again.`)
                } else {
                  c.message.channel.sendMessage(g.customize.timeout.replace(/%user/g, c.message.author.mention).replace(/%server/g, c.message.guild.name).replace(/%channel/, c.message.channel.name).replace(/%timeout/, Math.round(t)))
                }
              } else {
                if (r >= commands[cmd].level) {
                  if (!commands[cmd].hasOwnProperty('nsfw')) {
                    try {
                      commands[cmd].fn(c.message, suffix, bot)
                    } catch (e) {
                      c.message.channel.sendMessage('An error occurred while trying to process this command, you should let the bot author know. \n```' + e + '```')
                      Logger.error(`Command error, thrown by ${commands[cmd].name}: ${e}`, {
                        author: c.message.author,
                        guild: loggingGuild,
                        botID: bot.User.id,
                        cmd: cmd,
                        error: e
                      })
                    }
                  } else {
                    datacontrol.permissions.checkNSFW(c.message).then(function (q) {
                      if (q) {
                        try {
                          commands[cmd].fn(c.message, suffix, bot)
                        } catch (e) {
                          c.message.channel.sendMessage('An error occurred while trying to process this command, you should let the bot author know. \n```' + e + '```')
                          Logger.error(`Command error, thrown by ${commands[cmd].name}: ${e}`, {
                            author: c.message.author,
                            guild: loggingGuild,
                            botID: bot.User.id,
                            cmd: cmd,
                            error: e
                          })
                        }
                      } else {
                        if (g.customize.nsfw === null || g.customize.nsfw === 'default') {
                          c.message.channel.sendMessage('This channel does not allow NSFW commands, enable them first with `setnsfw`')
                        } else {
                          c.message.channel.sendMessage(g.customize.nsfw.replace(/%user/g, c.message.author.mention).replace(/%server/g, c.message.guild.name).replace(/%channel/, c.message.channel.name))
                        }
                      }
                    }).catch(function (e) {
                      Logger.error('Permission error: ' + e, {
                        author: c.message.author,
                        guild: loggingGuild,
                        botID: bot.User.id,
                        cmd: cmd
                      })
                    })
                  }
                } else {
                  if (g.customize.perms === null || g.customize.perms === 'default') {
                    if (r > -1 && !commands[cmd].hidden) {
                      var reason = (r > 4) ? '**This is a master user only command**, ask the bot owner to add you as a master user if you really think you should be able to use this command.' : 'Ask the server owner to modify your level with `setlevel`.'
                      c.message.channel.sendMessage('You have no permission to run this command!\nYou need level ' + commands[cmd].level + ', you have level ' + r + '\n' + reason)
                    }
                  } else {
                    c.message.channel.sendMessage(g.customize.perms.replace(/%user/g, c.message.author.mention).replace(/%server/g, c.message.guild.name).replace(/%channel/, c.message.channel.name).replace(/%nlevel/, commands[cmd].level).replace(/%ulevel/, r))
                  }
                }
              }
            })
          }
        }).catch(function (e) {
          Logger.error('Permission error: ' + e, {
            author: c.message.author,
            guild: loggingGuild,
            botID: bot.User.id,
            cmd: cmd,
            error: e
          })
        })
      } else {
        if (commands[cmd].noDM) {
          c.message.channel.sendMessage('This command cannot be used in DM, invite the bot to a server and try this command again.')
        } else {
          datacontrol.permissions.checkLevel(c.message, c.message.author.id, []).then(function (r) {
            if (r !== -1 && r >= commands[cmd].level) {
              try {
                commands[cmd].fn(c.message, suffix, bot)
              } catch (e) {
                c.message.channel.sendMessage('An error occured while trying to process this command, you should let the bot author know. \n```' + e + '```')
                Logger.error(`Command error, thrown by ${commands[cmd].name}: ${e}`)
              }
            } else {
              if (r === -1) {
                c.message.channel.sendMessage('You have been blacklisted from using this bot, for more help contact my developers.')
              } else {
                c.message.channel.sendMessage('You have no permission to run this command in DM, you probably tried to use restricted commands that are either for master users only or only for server owners.')
              }
            }
          }).catch(function (e) {
            Logger.error('Permission error: ' + e, {
              author: c.message.author,
              guild: loggingGuild,
              botID: bot.User.id,
              cmd: cmd,
              error: e
            })
          })
        }
      }
    }
  }).catch(function (e) {
    if (e === 'No database') {
      Logger.warn('Database file missing for a server, creating one now...')
    } else {
      Logger.error('Prefix error: ' + e, {
        author: c.message.author,
        guild: loggingGuild,
        botID: bot.User.id,
        error: e
      })
    }
  })
})

bot.Dispatcher.on(Event.GUILD_MEMBER_ADD, function (s) {
  datacontrol.permissions.isKnown(s.guild)
  datacontrol.customize.isKnown(s.guild)
  datacontrol.customize.check(s.guild).then((r) => {
    if (r === 'on' || r === 'channel') {
      datacontrol.customize.reply(s, 'welcomeChannel').then(rep => {
        datacontrol.customize.reply(s, 'welcomeMessage').then((x) => {
          var channel = s.guild.channels.find(g => g.id === rep)
          if (!channel) return
          if (x === null || x === 'default') {
            channel.sendMessage(`Welcome ${s.member.username} to ${s.guild.name}!`)
          } else {
            channel.sendMessage(x.replace(/%user/g, s.member.mention).replace(/%server/g, s.guild.name))
          }
        }).catch((e) => {
          Logger.error(e)
        })
      }).catch(e => {
        if (e === 'Unsupported reply method') return // oh well
        else Logger.error(e)
      })
    } else if (r === 'private') {
      datacontrol.customize.reply(s, 'welcomeMessage').then((x) => {
        if (x === null || x === 'default') {
          s.member.openDM().then((g) => g.sendMessage(`Welcome to ${s.guild.name}! Please enjoy your stay!`))
        } else {
          s.member.openDM().then((g) => g.sendMessage(x.replace(/%user/g, s.member.mention).replace(/%server/g, s.guild.name)))
        }
      }).catch((e) => {
        Logger.error(e)
      })
    }
  }).catch((e) => {
    Logger.error(e)
  })
  datacontrol.users.isKnown(s.member)
})

bot.Dispatcher.on(Event.GUILD_CREATE, function (s) {
  if (!bot.connected) return
  if (!s.becameAvailable) {
    datacontrol.permissions.isKnown(s.guild)
    datacontrol.customize.isKnown(s.guild)
  }
})

bot.Dispatcher.on(Event.GUILD_UPDATE, g => {
  if (!bot.connected) return
  var guild = g.getChanges()
  if (guild.before.owner_id !== guild.after.owner_id) {
    datacontrol.permissions.updateGuildOwner(g.guild)
  }
})

bot.Dispatcher.on(Event.GATEWAY_RESUMED, function () {
  Logger.info('Connection to the Discord gateway has been resumed.')
})

bot.Dispatcher.on(Event.PRESENCE_MEMBER_INFO_UPDATE, (user) => {
  datacontrol.users.isKnown(user.new).then(() => {
    if (user.old.username !== user.new.username) {
      datacontrol.users.namechange(user.new).catch((e) => {
        Logger.error(e)
      })
    }
  })
})

bot.Dispatcher.on(Event.GATEWAY_HELLO, (gatewayInfo) => {
  Logger.debug(`Gateway trace, ${gatewayInfo.data._trace}`, {
    botID: bot.User.id,
    gatewayTrace: gatewayInfo.data._trace
  })
})

bot.Dispatcher.on(Event.DISCONNECTED, function (e) {
  Logger.error('Disconnected from the Discord gateway: ' + e.error)
  Logger.info('Trying to login again...')
  start()
})

bot.Dispatcher.onAny((type, data) => {
  if (data.type === 'READY' || type === 'VOICE_CHANNEL_JOIN' || type === 'VOICE_CHANNEL_LEAVE' || type.indexOf('VOICE_USER') === 0 || type === 'PRESENCE_UPDATE' || type === 'TYPING_START' || type === 'GATEWAY_DISPATCH') return
  Bezerk.emit(type, data, bot)
})

process.on('unhandledRejection', (reason, p) => {
  if (p !== null && reason !== null) {
    if (reason instanceof Error) bugsnag.notify(reason)
    else bugsnag.notify(new Error(`Unhandlled promise: ${require('util').inspect(p, {depth: 3})}: ${reason}`))
  }
})

function start () {
  try {
    Config = require('./config.json')
  } catch (e) {
    Logger.error('Config error: ' + e)
    process.exit(0)
  }
  bot.connect({
    token: Config.bot.token
  })
}
