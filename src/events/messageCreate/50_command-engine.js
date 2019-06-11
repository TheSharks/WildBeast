const commands = require('../../components/commands')

module.exports = (msg) => {
  const prefix = process.env.BOT_PREFIX
  const suffix = msg.content.substr(prefix.length).split(' ').slice(1).join(' ')
  let cmd = msg.content.substr(prefix.length).split(' ')[0].toLowerCase()
  if (msg.content.startsWith(prefix)) {
    if (commands.aliases.has(cmd)) cmd = commands.aliases.get(cmd)
    if (commands.commands[cmd]) {
      const prereqs = commands.commands[cmd].runPrereqs(msg)
      if (!prereqs.passed) return msg.channel.createMessage(`Prereqs failed! ${prereqs.checks}`) // fixme
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
