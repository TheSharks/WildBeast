const Command = require('../../classes/Command')

module.exports = new Command(msg => {
  const client = require('../../components/client')
  const player = client.voiceConnectionManager.get(msg.channel.guild.id)
  if (!player) return msg.channel.createMessage("I'm not streaming in this server!")
  const newdjs = msg.mentions.filter(u => u.id !== client.user.id).map((user) => user.id)
  if (newdjs.length === 0) return msg.channel.createMessage('Please mention who you want to add as a DJ!')
  const total = player.addDJs(...newdjs)
  return msg.channel.createMessage(`Added ${newdjs.length} new DJ(s), there are now ${total} DJs`)
}, {
  customPrereq: ['musicCommand'],
  aliases: ['new-dj', 'new-djs', 'newdjs'],
  disableDM: true
})
