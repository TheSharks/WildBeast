const Command = require('../../classes/Command')

module.exports = new Command(async function (msg, suffix) {
  const client = require('../../components/client')
  if (!msg.member || !msg.member.voiceState.channelID) return this.safeSendMessage(msg.channel, i18n.t('commands.joinvoice.errors.notConnected'))
  if (client.voiceConnectionManager.get(msg.channel.guild.id)) return this.safeSendMessage(msg.channel, i18n.t('commands.joinvoice.errors.alreadyStreaming'))
  const channel = msg.channel.guild.channels.get(msg.member.voiceState.channelID)
  if (!channel.permissionsOf(client.user.id).has('voiceSpeak') || !channel.permissionsOf(client.user.id).has('voiceConnect')) {
    return this.safeSendMessage(msg.channel, i18n.t('commands.joinvoice.errors.cantConnect'))
  }
  try {
    const player = await channel.join()
    player.once('disconnected', () => client.voiceConnectionManager.delete(msg.channel.guild.id))
    player.on('warn', x => logger.warn('PLAYER', x))
    player.setVolume(50)
    client.voiceConnectionManager.add({
      id: msg.channel.guild.id,
      controllers: [msg.member.id],
      encoder: player,
      textChannel: msg.channel
    })
    if (suffix) require('./play').run(msg, suffix)
  } catch (e) {
    this.safeSendMessage(msg.channel, i18n.t('commands.joinvoice.errors.failed'))
    logger.error('CMD', e)
  }
}, {
  aliases: ['voice', 'join-voice'],
  disableDM: true
})
