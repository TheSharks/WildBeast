const Command = require('../../classes/Command')

module.exports = new Command(async function (msg, suffix) {
  const chunks = suffix.split(' ')
  const amount = chunks[chunks.length - 1]
  if (isNaN(amount)) return this.safeSendMessage(msg.channel, 'Your last argument must be a number')
  if (amount > 100 || amount < 2) return this.safeSendMessage(msg.channel, "You're trying to remove too many/few messages")
  const messages = (await msg.channel.getMessages(200, msg.id)).filter(x => new Date(msg.timestamp) - new Date(x.timestamp) < 1209600000)
  if (messages.length < 2) return this.safeSendMessage(msg.channel, 'I was not able to find any messages for purging that are under two weeks old')
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
