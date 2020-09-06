const Command = require('../../classes/Command')

module.exports = new Command(async function (msg, suffix) {
  const client = require('../../components/client')
  const encoder = client.voiceConnectionManager.get(msg.channel.guild.id)
  if (!encoder) return this.safeSendMessage(msg.channel, "I'm currently not streaming in this server")
  if (!encoder._encoder.state.position) return this.safeSendMessage(msg.channel, 'Not currently playing anything')
  if (!suffix) encoder._encoder.seek(0)
  else {
    const time = stringToMS(suffix)
    if (time === false) return this.safeSendMessage(msg.channel, 'Invalid time')
    encoder._encoder.seek(encoder._encoder.state.position + time)
  }
  if (msg.channel.permissionsOf(client.user.id).has('addReactions')) await msg.addReaction('👍')
}, {
  aliases: ['ff'],
  prereqs: ['musicCommand'],
  disableDM: true
})

const stringToMS = (ctx) => {
  const regex = /([0-9]+ ?[hms])/gi
  const parts = ctx.match(regex)
  if (parts.length === 0) return false
  return parts.map(x => {
    switch (x.charAt(x.length - 1)) {
      case 'h':
        return (parseInt(x) * 1000) * 3600
      case 'm':
        return (parseInt(x) * 1000) * 60
      case 's':
        return (parseInt(x) * 1000)
      default:
        return 0
    }
  }).reduce((a, b) => a + b, 0)
}
