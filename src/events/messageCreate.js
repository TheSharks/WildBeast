const commands = require('../internal/command-indexer')
const engines = {
  perms: require('../engines/permissions'),
  settings: require('../engines/settings')
}
const masters = process.env['WILDBEAST_MASTERS'].split('|')

module.exports = async (ctx) => {
  const msg = ctx[0]
  if (msg.author.bot) return
  const prefix = await engines.settings.prefix(msg.channel.guild, msg)
  if (msg.content.indexOf(prefix) === 0) {
    const cmd = msg.content.substr(prefix.length).split(' ')[0].toLowerCase()
    const suffix = msg.content.substr(prefix.length).split(' ').slice(1).join(' ')
    if (commands[cmd]) {
      if (commands[cmd].meta.level === Infinity && !masters.includes(msg.author.id)) {
        return msg.channel.createMessage('This command is only for the bot owner')
      }
      const res = await engines.perms.calculate(msg.channel.guild, msg.member)
      if (res >= commands[cmd].meta.level) commands[cmd].fn(msg, suffix)
      else if (res > 0) msg.channel.createMessage('You have no permission to run this command.')
    }
  }
}