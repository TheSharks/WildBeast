const Command = require('../../classes/Command')
const client = require('../../components/client')

module.exports = new Command(async msg => {
  const player = client.voiceConnectionManager.get(msg.channel.guild.id)
  if (!player) return msg.channel.createMessage("I'm not streaming in this server")
  player.next()
}, {
  customPrereq: ['musicCommand'],
  disableDM: true
})
