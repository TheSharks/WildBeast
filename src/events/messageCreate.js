const commands = require('../internal/command-indexer').commands
const aliases = require('../internal/command-indexer').alias
const help = require('../internal/command-indexer').help
const engines = {
  perms: require('../engines/permissions'),
  settings: require('../engines/settings'),
  timeout: require('../engines/timeouts')
}
const masters = process.env['WILDBEAST_MASTERS'].split('|')

module.exports = async (ctx) => {
  const msg = ctx[0]
  if (msg.author.bot) return
  const prefix = (msg.channel.guild) ? await engines.settings.prefix(msg.channel.guild, msg) : process.env.BOT_PREFIX
  if (msg.content.indexOf(prefix) === 0) {
    let cmd = msg.content.substr(prefix.length).split(' ')[0].toLowerCase()
    if (aliases.has(cmd)) cmd = aliases.get(cmd)
    const suffix = msg.content.substr(prefix.length).split(' ').slice(1).join(' ')
    if (cmd === 'help') return help(msg.author.id, msg.channel, suffix) // help is special, its not a 'real' command
    if (commands[cmd]) {
      if (commands[cmd].meta.level === Infinity && !masters.includes(msg.author.id)) {
        return msg.channel.createMessage('This command is only for the bot owner.')
      }
      if (!msg.channel.guild && commands[cmd].meta.noDM) {
        return msg.channel.createMessage('This command cannot be used in Direct Messages.')
      }
      let time = true
      if (commands[cmd].meta.timeout) time = engines.timeout.calculate((msg.channel.guild ? msg.channel.guild.id : msg.author.id), cmd, commands[cmd].meta.timeout)
      if (time !== true) {
        return msg.channel.createMessage(`This command is on cooldown for another ${Math.floor(time)} seconds.`)
      }
      const res = (msg.channel.guild) ? await engines.perms.calculate(msg.channel.guild, msg.member) : await engines.perms.calculate(false, msg.author)
      if (res >= commands[cmd].meta.level) {
        global.logger.command({
          cmd: cmd,
          opts: suffix,
          m: msg
        })
        commands[cmd].fn(msg, suffix)
      } else if (res > 0) msg.channel.createMessage('You have no permission to run this command.')
    }
  }
}
