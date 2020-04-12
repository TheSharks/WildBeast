const Command = require('../../classes/Command')
const client = require('../../components/client')

module.exports = new Command(async (msg, suffix) => {
  if (!msg.member || !msg.member.voiceState.channelID) return msg.channel.createMessage('Please join a voice channel and try this command again')
  if (client.voiceConnections.get(msg.channel.guild.id)) return msg.channel.createMessage("I'm already streaming in this server!")
  const player = await msg.channel.guild.channels.get(msg.member.voiceState.channelID).join()
  client.wildbeastVoiceConnections.add({
    id: msg.channel.guild.id,
    controllers: [msg.member.id],
    encoder: player,
    textChannel: msg.channel
  })
}, {

})
