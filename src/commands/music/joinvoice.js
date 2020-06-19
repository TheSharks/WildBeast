const Command = require('../../classes/Command')
const logger = require('../../internal/logger')

module.exports = new Command(async msg => {
  const client = require('../../components/client')
  if (!msg.member || !msg.member.voiceState.channelID) return msg.channel.createMessage('Please join a voice channel and try this command again')
  if (client.voiceConnectionManager.get(msg.channel.guild.id)) return msg.channel.createMessage("I'm already streaming in this server!")
  const channel = msg.channel.guild.channels.get(msg.member.voiceState.channelID)
  if (!channel.permissionsOf(client.user.id).has('voiceSpeak') || !channel.permissionsOf(client.user.id).has('voiceConnect')) {
    return msg.channel.createMessage("I can't connect to the channel you're currently in!")
  }
  try {
    const player = await channel.join()
    player.once('disconnected', console.log)
    player.on('warn', console.log)
    player.setVolume(80)
    client.voiceConnectionManager.add({
      id: msg.channel.guild.id,
      controllers: [msg.member.id],
      encoder: player,
      textChannel: msg.channel
    })
  } catch (e) {
    msg.channel.createMessage('Failed to join voice channel, try again?')
    logger.error(e)
  }
}, {
  aliases: ['voice', 'join-voice'],
  disableDM: true
})
