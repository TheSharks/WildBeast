const Command = require('../../classes/Command')

module.exports = new Command(function (msg) {
  const client = require('../../components/client')
  const player = client.voiceConnectionManager.get(msg.channel.guild.id)
  if (!player) return this.safeSendMessage(msg.channel, "I'm not streaming in this server!")
  const newdjs = msg.mentions.filter(u => u.id !== client.user.id).map((user) => user.id)
  if (newdjs.length === 0) return this.safeSendMessage(msg.channel, 'Please mention who you want to add as a DJ!')
  const total = player.addDJs(...newdjs)
  return this.safeSendMessage(msg.channel, `Added ${newdjs.length} new DJ(s), there are now ${total} DJs`)
}, {
  prereqs: ['musicCommand'],
  aliases: ['new-dj', 'new-djs', 'newdjs'],
  disableDM: true
})
