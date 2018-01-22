const commands = require('../internal/command-indexer')
const perms = require('../engines/permissions')
const masters = process.env['WILDBEAST_MASTERS'].split('|')

module.exports = (ctx) => {
  let msg = ctx[0]
  if (msg.author.bot) return
  if (msg.content.indexOf(process.env['BOT_PREFIX']) === 0) {
    let cmd = msg.content.substr(process.env['BOT_PREFIX'].length).split(' ')[0].toLowerCase()
    let suffix = msg.content.substr(process.env['BOT_PREFIX'].length).split(' ').slice(1).join(' ')
    if (commands[cmd]) {
      if (commands[cmd].meta.level === Infinity && !masters.includes(msg.author.id)) {
        return msg.channel.createMessage('This command is only for the bot owner')
      }
      perms.calculate(msg.channel.guild, msg.member).then(res => {
        if (res >= commands[cmd].meta.level) commands[cmd].fn(msg, suffix)
        else if (res > 0) msg.channel.createMessage('You have no permission to run this command.')
      })
    }
  }
}
