const Command = require('../../classes/Command')

module.exports = new Command(async function (msg, suffix) {
  const client = require('../../components/client')
  const player = client.voiceConnectionManager.get(msg.channel.guild.id)
  if (!player) return this.safeSendMessage(msg.channel, "I'm not streaming in this server")
  if (isNaN(suffix) || suffix > 100 || suffix < 0) return this.safeSendMessage(msg.channel, 'Volume must be a number between 0 and 100')
  player._encoder.setVolume(suffix)
  return this.safeSendMessage(msg.channel, 'Volume adjusted')
}, {
  prereqs: ['musicCommand'],
  disableDM: true
})
