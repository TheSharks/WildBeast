const Command = require('../../classes/Command')

module.exports = new Command(async function (msg) {
  const client = require('../../components/client')
  const player = client.voiceConnectionManager.get(msg.channel.guild.id)
  if (!player) return this.safeSendMessage(msg.channel, i18n.t('commands.common.notStreaming'))
  if (player.playlist.length === 0) return this.safeSendMessage(msg.channel, i18n.t('commands.skip.queueEmpty'))
  if (player.playlist[0].needsResolve) msg.channel.sendTyping()
  player.next()
}, {
  prereqs: ['musicCommand'],
  disableDM: true
})
