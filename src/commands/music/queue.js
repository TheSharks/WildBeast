const Command = require('../../classes/Command')

module.exports = new Command(async function (msg) {
  const client = require('../../components/client')
  const player = client.voiceConnectionManager.get(msg.channel.guild.id)
  if (!player) return this.safeSendMessage(msg.channel, i18n.t('commands.common.notStreaming'))
  return this.safeSendMessage(msg.channel, createEmbed(player.playlist))
}, {
  clientPerms: {
    channel: ['embedLinks']
  },
  disableDM: true,
  aliases: ['playlist', 'pl']
})

const createEmbed = (ctx) => {
  return {
    embed: {
      title: i18n.t('commands.queue.title'),
      description:
        (ctx.length > 0)
          ? i18n.t('commands.queue.count', { songs: ctx.length })
          : i18n.t('commands.queue.empty', { command: `${process.env.BOT_PREFIX}play` }),
      fields: ctx.slice(0, 10).map(x => {
        return {
          name: ctx.indexOf(x) + 1,
          value: `[${x.info.title} - ${x.info.author}](${x.info.uri})`
        }
      })
    }
  }
}
