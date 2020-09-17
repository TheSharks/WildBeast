const Command = require('../../classes/Command')

module.exports = new Command(async function (msg, suffix) {
  const client = require('../../components/client')
  const player = client.voiceConnectionManager.get(msg.channel.guild.id)
  if (!player) return this.safeSendMessage(msg.channel, i18n.t('commands.common.notStreaming'))
  if (isNaN(suffix) || suffix > 100 || suffix < 0) return this.safeSendMessage(msg.channel, i18n.t('commands.volume.outOfRange'))
  player._encoder.setVolume(suffix)
  return this.safeSendMessage(msg.channel, i18n.t('commands.volume.done'))
}, {
  prereqs: ['musicCommand'],
  disableDM: true
})
