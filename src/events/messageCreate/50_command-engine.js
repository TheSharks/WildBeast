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

const generateHelpMessage = async (msg, suffix) => {
  const client = require('../../components/client')
  const generateEmbed = (name, cmd) => {
    return {
      title: `Help for command ${name}`,
      description: cmd.props.helpMessage,
      color: 0xFE8E08,
      footer: {
        icon_url: client.user.dynamicAvatarURL(),
        text: `${client.user.username} - Powered by WildBeast`
      }
    }
  }
  if (!suffix) {
    const pages = require('../../components/paginator')
    await pages.init(msg.author.id, msg.channel, Object.keys(commands.commands).filter(x => !commands.commands[x].props.hidden).map(x => generateEmbed(x, commands.commands[x])), 'See <https://wildbeast.guide/commands> for a full list of commands')
  } else {
    if (!commands.commands[suffix]) return msg.channel.createMessage('No such command')
    await msg.channel.createMessage({ embed: generateEmbed(suffix, commands.commands[suffix]) })
  }
}
