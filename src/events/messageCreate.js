const commands = require('../internal/command-indexer').commands
const aliases = require('../internal/command-indexer').alias
const help = require('../internal/command-indexer').help
const engines = {
  perms: require('../features/permissions'),
  settings: require('../features/settings'),
  timeout: require('../features/timeouts'),
  blockade: require('../features/blocking'),
  flags: require('../features/flags')
}
const masters = process.env.WILDBEAST_MASTERS.split('|')

module.exports = async (ctx) => {
  const msg = ctx[0]
  if (msg.author.bot) return
  if (msg.channel.guild && !msg.channel.permissionsOf(global.bot.user.id).has('sendMessages')) return // we cant even respond to this
  if (msg.channel.guild) {
    if (await engines.flags.has('GuildBlacklisted', msg.channel.guild)) {
      global.logger.debug('Detected guild blacklist, leaving')
      return msg.channel.guild.leave()
    }
  }
  const prefix = (msg.channel.guild) ? await engines.settings.prefix(msg.channel.guild, msg) : process.env.BOT_PREFIX
  if (msg.content.indexOf(prefix) === 0) {
    if (global.logger._raven) {
      global.logger._raven.setContext({
        user: {
          id: msg.author.id,
          username: `${msg.author.username}#${msg.author.discriminator}`
        }
      })
    }
    let cmd = msg.content.substr(prefix.length).split(' ')[0].toLowerCase()
    if (aliases.has(cmd)) cmd = aliases.get(cmd)
    const suffix = msg.content.substr(prefix.length).split(' ').slice(1).join(' ')
    if (cmd === 'help') return help(msg.author.id, msg.channel, suffix) // help is special, its not a 'real' command
    if (commands[cmd]) {
      const blocks = await engines.blockade.blacklist(ctx[0].channel)
      if (blocks.deny.includes(cmd) || (blocks.deny.includes('all') && !blocks.allow.includes(cmd))) return global.i18n.send('CMD_DISABLED_CHANNEL', msg.channel)
      if (commands[cmd].meta.module !== undefined) {
        let mod = commands[cmd].meta.module.toLowerCase()
        if ((blocks.deny.includes(mod) && !blocks.allow.includes(cmd)) || (blocks.deny.includes('all') && !blocks.allow.includes(cmd) && !blocks.allow.includes(mod))) return global.i18n.send('CMD_DISABLED_CHANNEL', msg.channel)
        // IF deny includes module BUT allow includes command, pass
        // IF deny includes all BUT allow includes module or cmd, pass
        // ELSE, block
      }
      if (msg.channel.guild && commands[cmd].meta.nsfw && !msg.channel.nsfw) return global.i18n.send('NSFW_NOT_ENABLED', msg.channel)
      if (commands[cmd].meta.level === Infinity && !masters.includes(msg.author.id)) {
        return global.i18n.send('BOT_OWNER_ONLY', msg.channel)
      }
      if (!msg.channel.guild && commands[cmd].meta.noDM) {
        return global.i18n.send('NO_DM', msg.channel)
      }
      let time = true
      if (commands[cmd].meta.timeout) time = engines.timeout.calculate((msg.channel.guild ? msg.channel.guild.id : msg.author.id), cmd, commands[cmd].meta.timeout)
      if (time !== true) {
        return global.i18n.send('COOLDOWN', msg.channel, { time: Math.floor(time) })
      }
      const level = await engines.blockade.checkDynPerm(cmd, msg.channel.guild) || commands[cmd].meta.level
      const res = (msg.channel.guild) ? await engines.perms.calculate(msg.channel.guild, msg.member, level) : await engines.perms.calculate(false, msg.author, level)
      if (res === true) {
        try {
          if (global.logger._raven) {
            global.logger._raven.captureBreadcrumb({
              message: 'A command is being ran.',
              category: 'command',
              data: {
                cmd: cmd,
                args: suffix
              }
            })
          }
          commands[cmd].fn(msg, suffix)
        } catch (e) {
          global.logger.error(e)
          global.i18n.send('COMMAND_ERROR', msg.channel, {
            message: e.message
          })
        } finally {
          global.logger.command({
            cmd: cmd,
            opts: suffix,
            m: msg
          })
        }
      } else if (res !== null) return global.i18n.send('NO_PERMS', msg.channel)
    }
  }
}
