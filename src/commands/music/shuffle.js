const Command = require('../../classes/Command')

module.exports = new Command(async function (msg) {
  const client = require('../../components/client')
  const player = client.voiceConnectionManager.get(msg.channel.guild.id)
  if (!player) return this.safeSendMessage(msg.channel, "I'm not streaming in this server")
  player.shuffle()
  return this.safeSendMessage(msg.channel, 'The playlist has been shuffled')
}, {
  prereqs: ['musicCommand'],
  disableDM: true
})
