const commands = require('../../components/commands')
const { commands: cmdAnalytics } = require('../../components/analytics')

module.exports = (msg) => {
  const prefix = process.env.BOT_PREFIX
  const suffix = msg.content.substr(prefix.length).split(' ').slice(1).join(' ')
  let cmd = msg.content.substr(prefix.length).split(' ')[0].toLowerCase()
  if (msg.content.startsWith(prefix)) {
    if (commands.aliases.has(cmd)) cmd = commands.aliases.get(cmd)
    const command = commands.commands[cmd]
    if (command) {
      try {
        command.runWithPrereqs(msg, suffix)
      } catch (e) {
        logger.error('COMMANDS', e)
      } finally {
        cmdAnalytics.labels(cmd).inc()
        logger.command({
          cmd: cmd,
          opts: suffix,
          m: msg
        })
      }
    }
  }
}
