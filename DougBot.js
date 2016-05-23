'use strict'
process.title = 'WildBeast'
var Discordie = require('discordie')
var Event = Discordie.Events
var bot = new Discordie()
var runtime = require('./runtime/runtime.js')
var Logger = runtime.internal.logger.Logger
var timeout = runtime.internal.timeouts
var commands = runtime.commandcontrol.Commands
var aliases = runtime.commandcontrol.Aliases
var datacontrol = runtime.datacontrol
var argv = require('minimist')(process.argv.slice(2))
var Config
var restarted = false

Logger.info('Initializing...')

if (argv.forceupgrade) {
  Logger.warn('Force-starting database upgrade.')
  runtime.internal.upgrade.init().then((r) => {
    Logger.info(r)
    start()
  }).catch((e) => {
    Logger.error(e)
  })
}

if (!argv.forceupgrade) {
  try {
    require('fs').readFileSync('./runtime/initial.txt')
    start()
  } catch (e) {
    if (!argv.noinitial) {
      runtime.internal.init.initial().then(function () {
        start()
      })
    } else {
      Logger.debug('Skipped init via argv')
      require('fs').writeFileSync('./runtime/initial.txt', 'Initial setup skipped.')
      start()
    }
  }
}

bot.Dispatcher.on(Event.GATEWAY_READY, function () {
  Logger.info('Ready to start!')
  Logger.info(`Logged in as ${bot.User.username}#${bot.User.discriminator} (ID: ${bot.User.id}) and serving ${bot.Users.length} users in ${bot.Guilds.length} servers.`)
})

bot.Dispatcher.on(Event.MESSAGE_CREATE, function (c) {
  if (!bot.connected) return
  datacontrol.users.isKnown(c.message.author)
  var prefix
  datacontrol.customize.prefix(c.message).then(function (r) {
    if (!r) {
      prefix = Config.settings.prefix
    } else {
      prefix = r
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
    if (c.message.author.bot || c.message.author.id === bot.User.id) {
      return
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
      Logger.info(`Executing <${c.message.resolveContent()}> from ${c.message.author.username}`)
      if (!c.message.isPrivate) {
        timeout.check(commands[cmd], c.message.guild.id, c.message.author.id).then((r) => {
          if (r !== true) {
            datacontrol.customize.reply(c.message, 'timeout').then((x) => {
              if (x === 'default') {
                c.message.channel.sendMessage(`Wait ${Math.round(r)} more seconds before using that again.`)
              } else {
                c.message.channel.sendMessage(x.replace(/%user/g, c.message.author.username).replace(/%server/g, c.message.guild.name).replace(/%channel/, c.message.channel.name).replace(/%timeout/, Math.round(r)))
              }
            })
          } else {
            datacontrol.permissions.checkLevel(c.message, c.message.author.id).then(function (r) {
              if (r >= commands[cmd].level) {
                if (!commands[cmd].hasOwnProperty('nsfw')) {
                  try {
                    commands[cmd].fn(c.message, suffix, bot)
                  } catch (e) {
                    c.message.channel.sendMessage('**Aww shit!**\n```' + e + '```')
                  }
                } else {
                  datacontrol.permissions.checkNSFW(c.message).then(function (r) {
                    if (r) {
                      try {
                        commands[cmd].fn(c.message, suffix, bot)
                      } catch (e) {
                        c.message.channel.sendMessage('**Aww shit!**\n```' + e + '```')
                      }
                    } else {
                      datacontrol.customize.reply(c.message, 'nsfw').then((r) => {
                        if (r === 'default') {
                          c.message.channel.sendMessage('You have no permission to run this command!')
                        } else {
                          c.message.channel.sendMessage(r.replace(/%user/g, c.message.author.username).replace(/%server/g, c.message.guild.name).replace(/%channel/, c.message.channel.name))
                        }
                      }).catch((e) => {
                        Logger.error('Reply check error, ' + e)
                      })
                    }
                  }).catch(function (e) {
                    Logger.error('Permission error: ' + e)
                  })
                }
              } else {
                datacontrol.customize.reply(c.message, 'permissions').then((r) => {
                  if (r === 'default') {
                    c.message.channel.sendMessage('You have no permission to run this command!')
                  } else {
                    c.message.channel.sendMessage(r.replace(/%user/g, c.message.author.username).replace(/%server/g, c.message.guild.name).replace(/%channel/, c.message.channel.name))
                  }
                }).catch((e) => {
                  Logger.error('Reply check error, ' + e)
                })
              }
            }).catch(function (e) {
              Logger.error('Permission error: ' + e)
            })
          }
        })
      } else {
        if (commands[cmd].noDM) {
          c.message.channel.sendMessage('This command cannot be used in DM.')
          return
        }
        datacontrol.permissions.checkLevel(c.message, c.message.author.id).then(function (r) {
          if (r >= commands[cmd].level) {
            try {
              commands[cmd].fn(c.message, suffix, bot)
            } catch (e) {
              c.message.channel.sendMessage('**Aww shit!**\n```' + e + '```')
            }
          } else {
            c.message.channel.sendMessage('You have no permission to run this command in DM!')
          }
        }).catch(function (e) {
          Logger.error('Permission error: ' + e)
        })
      }
    }
  }).catch(function (e) {
    Logger.error('Prefix error: ' + e)
  })
})

bot.Dispatcher.on(Event.GUILD_MEMBER_ADD, function (s) {
  datacontrol.permissions.isKnown(s.guild)
  datacontrol.customize.isKnown(s.guild)
  datacontrol.customize.check(s.guild).then((r) => {
    if (r === 'on') {
      datacontrol.customize.reply(s, 'welcome').then((x) => {
        s.guild.generalChannel.sendMessage(x.replace(/%user/g, s.member.username).replace(/%server/g, s.guild.name))
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

bot.Dispatcher.on(Event.GATEWAY_RESUMED, function () {
  Logger.info('Connection to the Discord gateway has been resumed.')
})

bot.Dispatcher.on(Event.PRESENCE_MEMBER_INFO_UPDATE, (user) => {
  datacontrol.users.isKnown(user.new).catch(() => {
    datacontrol.users.namechange(user.new).catch((e) => {
      Logger.error(e)
    })
  })
  // We only handle name changes, nothing else
  if (user.old.username !== user.new.username) {
    datacontrol.users.namechange(user.new)
  }
})

bot.Dispatcher.on(Event.DISCONNECTED, function (e) {
  Logger.error('Disconnected from the Discord gateway: ' + e.error)
  if (!restarted) {
    restarted = true
    Logger.info('Trying to login again...')
    start()
  } else {
    Logger.warn('Something happened while reconnecting. Not trying to login again, exiting...')
    process.exit(1)
  }
})

function start () {
  runtime.internal.versioncheck.versionCheck(function (err, res) {
    if (err) {
      Logger.error('Version check failed, ' + err)
    } else if (res) {
      Logger.info(res)
    }
  })
  try {
    Config = require('./config.json')
  } catch (e) {
    Logger.error('Config error: ' + e)
    process.exit(0)
  }
  if (Config.bot.isbot) {
    bot.connect({
      token: Config.bot.token
    })
  } else {
    bot.connect({
      email: Config.bot.email,
      password: Config.bot.password
    })
  }
}
