const Command = require('../../classes/Command')

module.exports = new Command(async msg => {
  const client = require('../../components/client')
  const encoder = client.voiceConnectionManager.get(msg.channel.guild.id)
  if (!encoder) return msg.channel.createMessage("I'm currently not streaming in this server")
  client.voiceConnections.leave(msg.channel.guild)
  client.voiceConnectionManager.delete(msg.channel.guild.id)
}, {
  aliases: ['leave-voice', 'stop'],
  prereqs: ['musicCommand'],
  disableDM: true
})
