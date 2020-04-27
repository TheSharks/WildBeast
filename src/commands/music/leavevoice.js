const Command = require('../../classes/Command')
const client = require('../../components/client')

module.exports = new Command(async msg => {
  const encoder = client.voiceConnectionManager.get(msg.channel.guild.id)
  if (!encoder) return msg.channel.createMessage("I'm currently not streaming in this server")
  encoder.destroy()
  client.voiceConnectionManager.delete(msg.channel.guild.id)
}, {
  aliases: ['leave-voice'],
  customPrereqs: ['musicCommand'],
  disableDM: true
})
