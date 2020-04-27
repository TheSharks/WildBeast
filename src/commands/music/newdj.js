const Command = require('../../classes/Command')
const client = require('../../components/client')

module.exports = new Command((msg, suffix) => {
  const player = client.voiceConnectionManager.get(msg.channel.guild.id)
  if (!player) return msg.channel.createMessage("I'm not streaming in this server!")
  const newdjs = msg.mentions.filter(u => u.id !== client.user.id).map((user) => user.id)
  const total = player.addDJs(...newdjs)
  return msg.channel.createMessage(`Added ${newdjs.length} new DJ(s), there are now ${total} DJs`)
}, {
  customPrereq: ['musicCommand'],
  aliases: ['new-dj', 'new-djs', 'newdjs'],
  disableDM: true
})
