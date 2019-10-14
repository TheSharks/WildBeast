const commands = require('../../components/commands')
const { commands: cmdAnalytics } = require('../../components/analytics')
const masters = process.env.WILDBEAST_MASTERS.split(',')

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
        if (masters.includes(msg.author.id)) command.run(msg, suffix)
        else command.runWithPrereqs(msg, suffix)
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
  const channel = (msg.channel.guild) ? await msg.author.getDMChannel() : msg.channel
  if (suffix) {
    const cmd = commands.commands[suffix]
    if (!cmd) return channel.createMessage('No such command')
    else {
      return channel.createMessage({
        embed: {
          title: `Help for command ${suffix}`,
          description: cmd.props.helpMessage,
          color: 0xFE8E08,
          fields: [
            {
              name: 'Category',
              value: cmd.props.category,
              inline: true
            },
            {
              name: 'Access level',
              value: cmd.props.accessLevel,
              inline: true
            }
          ],
          footer: {
            icon_url: client.user.dynamicAvatarURL(),
            text: `${client.user.username} - Powered by WildBeast`
          }
        }
      }).then(() => {
        msg.addReaction(String.fromCharCode(0x2705)) // White Heavy Check Mark
      }).catch(e => {
        if (e.code === 50007) return msg.channel.createMessage('DMs disabled')
        else throw e
      })
    }
  }
}
