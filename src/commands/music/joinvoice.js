const Command = require('../../classes/Command')
const client = require('../../components/client')

module.exports = new Command(async msg => {
  if (!msg.member || !msg.member.voiceState.channelID) return msg.channel.createMessage('Please join a voice channel and try this command again')
  if (client.voiceConnections.get(msg.channel.guild.id)) return msg.channel.createMessage("I'm already streaming in this server!")
  const channel = msg.channel.guild.channels.get(msg.member.voiceState.channelID)
  if (channel.permissionsOf(client.user.id).has('voiceSpeak') || channel.permissionsOf(client.user.id).has('voiceConnect')) {
    return msg.channel.createMessage("I can't connect to the channel you're currently in!")
  }
  const player = await channel.join()
  client.voiceConnectionManager.add({
    id: msg.channel.guild.id,
    controllers: [msg.member.id],
    encoder: player,
    textChannel: msg.channel
  })
}, {
  aliases: ['voice', 'join-voice'],
  disableDM: true
})
