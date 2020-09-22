const Command = require('../../classes/Command')

module.exports = new Command(function (msg) {
  const client = require('../../components/client')
  const player = client.voiceConnectionManager.get(msg.channel.guild.id)
  if (!player) return this.safeSendMessage(msg.channel, i18n.t('commands.common.notStreaming'))
  const newdjs = msg.mentions.filter(u => u.id !== client.user.id).map((user) => user.id)
  if (newdjs.length === 0) return this.safeSendMessage(msg.channel, i18n.t('commands.newdj.errors.noMentions'))
  const total = player.addDJs(...newdjs)
  return this.safeSendMessage(msg.channel, i18n.t('commands.newdj.done', { new: newdjs.length, total }))
}, {
  prereqs: ['musicCommand'],
  aliases: ['new-dj', 'new-djs', 'newdjs'],
  disableDM: true
})
