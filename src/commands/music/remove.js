const Command = require('../../classes/Command')

module.exports = new Command(function (msg, suffix) {
  const client = require('../../components/client')
  const player = client.voiceConnectionManager.get(msg.channel.guild.id)
  if (player) {
    if (isNaN(parseInt(suffix))) return this.safeSendMessage(msg.channel, i18n.t('commands.remove.notANumber'))
    suffix = parseInt(suffix)
    if (suffix < 1 || suffix > player.playlist.length) return this.safeSendMessage(msg.channel, i18n.t('commands.remove.outOfRange', { songs: player.playlist.length }))
    const removed = player.playlist.splice(suffix - 1, 1)[0]
    return this.safeSendMessage(msg.channel, {
      content: i18n.t('commands.remove.done'),
      embed: {
        url: removed.info.uri,
        title: removed.info.title || '[Unknown!]',
        author: {
          name: removed.info.author || '[Unknown!]',
          ...(removed.info.authorImage ? { icon_url: removed.info.authorImage } : {}),
          ...(removed.info.authorURL ? { url: removed.info.authorURL } : {})
        },
        ...(removed.info.image ? { thumbnail: { url: removed.info.image } } : {})
      }
    })
  }
}, {
  prereqs: ['musicCommand'],
  aliases: ['rem'],
  disableDM: true
})
