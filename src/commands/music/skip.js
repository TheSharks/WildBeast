const Command = require('../../classes/Command')

module.exports = new Command(async msg => {
  const client = require('../../components/client')
  const player = client.voiceConnectionManager.get(msg.channel.guild.id)
  if (!player) return msg.channel.createMessage("I'm not streaming in this server")
  player.next()
}, {
  prereqs: ['musicCommand'],
  disableDM: true
})
