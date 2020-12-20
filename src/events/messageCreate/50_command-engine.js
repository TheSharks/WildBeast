const commands = require('../../components/commands')
const { commands: cmdAnalytics } = require('../../components/analytics')

module.exports = (ctx) => {
  const msg = ctx.message
  const prefix = process.env.BOT_PREFIX
  const suffix = msg.content.substr(prefix.length).split(' ').slice(1).join(' ')
  let cmd = msg.content.substr(prefix.length).split(' ')[0].toLowerCase()
  if (msg.content.startsWith(prefix)) {
    if (commands.aliases.has(cmd)) cmd = commands.aliases.get(cmd)
    const command = commands.commands[cmd]
    if (command) {
      try {
        command.run(msg, suffix)
      } catch (e) {
        const uid = logger.error('COMMANDS', e)
        command.safeSendMessage(msg.channel, i18n.t('commands.common.failedToRun', { errorcode: uid }))
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
