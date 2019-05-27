const commands = require('../../components/commands')

module.exports = (ctx) => {
  const msg = ctx[0]
  const prefix = process.env.BOT_PREFIX
  const suffix = msg.content.substr(prefix.length).split(' ').slice(1).join(' ')
  let cmd = msg.content.substr(prefix.length).split(' ')[0].toLowerCase()
  if (msg.content.startsWith(prefix)) {
    if (commands.aliases.has(cmd)) cmd = commands.aliases.get(cmd)
    if (commands.commands[cmd]) {
      try {
        commands.commands[cmd].run(msg, suffix)
      } catch (e) {
        logger.error('COMMANDS', e)
      } finally {
        logger.command({
          cmd: cmd,
          opts: suffix,
          m: msg
        })
      }
    }
  }
}
