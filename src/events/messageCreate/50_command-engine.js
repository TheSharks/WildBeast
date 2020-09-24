const commands = require('../../components/commands')
const { commands: cmdAnalytics } = require('../../components/analytics')

module.exports = (msg) => {
  const prefix = process.env.BOT_PREFIX
  const suffix = msg.content.substr(prefix.length).split(' ').slice(1).join(' ')
  let cmd = msg.content.substr(prefix.length).split(' ')[0].toLowerCase()
  if (msg.content.startsWith(prefix)) {
    if (cmd === 'help') return generateHelpMessage(msg, suffix)
    if (commands.aliases.has(cmd)) cmd = commands.aliases.get(cmd)
    const command = commands.commands[cmd]
    if (command) {
      try {
        command.runWithPrereqs(msg, suffix)
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

const generateHelpMessage = async (msg, suffix) => {
  const client = require('../../components/client')
  const generateEmbed = (name, cmd) => {
    return {
      title: i18n.t('commands.help.title', { cmd: name }),
      description: cmd.props.helpMessage,
      color: 0xFE8E08,
      footer: {
        icon_url: client.user.dynamicAvatarURL(),
        text: i18n.t('commands.help.footer', { botname: client.user.username })
      }
    }
  }
  if (!suffix) {
    const pages = require('../../components/paginator')
    await pages.init(msg.author.id, msg.channel, Object.keys(commands.commands).filter(x => !commands.commands[x].props.hidden).map(x => generateEmbed(x, commands.commands[x])), i18n.t('commands.help.header'))
  } else {
    if (!commands.commands[suffix]) return msg.channel.createMessage(i18n.t('commands.help.errors.notFound'))
    await msg.channel.createMessage({ embed: generateEmbed(suffix, commands.commands[suffix]) })
  }
}
