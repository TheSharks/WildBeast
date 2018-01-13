const commands = require('../internal/command-indexer')

module.exports = (ctx) => {
  let msg = ctx[1]
  if (msg.author.bot) return
  if (msg.content.indexOf(process.env['BOT_PREFIX']) === 0) {
    let cmd = msg.content.substr(process.env['BOT_PREFIX'].length).split(' ')[0].toLowerCase()
    if (commands[cmd]) commands[cmd].fn(msg)
  }
}
