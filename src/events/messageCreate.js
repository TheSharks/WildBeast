const commands = require('../internal/command-indexer')
const perms = require('../engines/permissions')

module.exports = (ctx) => {
  let msg = ctx[0]
  if (msg.author.bot) return
  if (msg.content.indexOf(process.env['BOT_PREFIX']) === 0) {
    perms.calculate(msg.channel.guild, msg.member).then(res => {
      let cmd = msg.content.substr(process.env['BOT_PREFIX'].length).split(' ')[0].toLowerCase()
      if (commands[cmd]) {
        if (res > commands[cmd].meta.level) commands[cmd].fn(msg)
        else msg.channel.createMessage('You have no permission to run this command.')
      }
    })
  }
}
