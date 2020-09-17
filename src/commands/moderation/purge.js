const Command = require('../../classes/Command')

module.exports = new Command(async function (msg, suffix) {
  const chunks = suffix.split(' ')
  const amount = chunks[chunks.length - 1]
  if (isNaN(amount)) return this.safeSendMessage(msg.channel, i18n.t('commands.purge.notANumber'))
  if (amount > 100 || amount < 2) return this.safeSendMessage(msg.channel, i18n.t('commands.purge.tooManyOrFew', { num: (amount < 2 ? 'few' : 'many') }))
  const messages = (await msg.channel.getMessages(200, msg.id)).filter(x => new Date(msg.timestamp) - new Date(x.timestamp) < 1209600000)
  if (messages.length < 2) return this.safeSendMessage(msg.channel, i18n.t('commands.purge.noResults'))
  if (msg.mentions.length > 0) {
    const ids = msg.mentions.map(x => x.id)
    await msg.channel.deleteMessages(messages.filter(x => ids.includes(x.author.id)).map(x => x.id).slice(0, amount))
  } else await msg.channel.deleteMessages(messages.map(x => x.id).slice(0, amount))
}, {
  clientPerms: {
    channel: ['manageMessages', 'readMessageHistory']
  },
  userPerms: {
    channel: ['manageMessages']
  },
  disableDM: true,
  aliases: ['clean', 'filter']
})
