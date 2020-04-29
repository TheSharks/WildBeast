module.exports = {
  meta: {
    help: 'Change my playing status on Discord to something else or pass nothing to clear the status!',
    level: Infinity,
    alias: ['status'],
    doNotDocument: true
  },
  fn: function (msg, suffix) {
    const bot = global.bot
    const first = suffix.split(' ')
    if (!suffix) {
      bot.editStatus('online', null)
      msg.channel.createMessage('Cleared status.')
    } else {
      if (/^https?/.test(first[0])) {
        bot.editStatus(null, {
          name: (first[1] ? suffix.substring(first[0].length + 1) : null),
          url: first[0]
        })
        msg.channel.createMessage(`Set status to streaming with message ${suffix.substring(first[0].length + 1)}`)
      } else if (['online', 'idle', 'dnd', 'invisible'].indexOf(first[0]) > -1) {
        bot.editStatus(first[0], {
          name: (first[1] ? suffix.substring(first[0].length + 1) : null)
        })
        msg.channel.createMessage(`Set status to ${first[0]} with message ${suffix.substring(first[0].length + 1)}`)
      } else if (suffix) {
        bot.editStatus(msg.channel.guild.members.get(msg.channel.guild.shard.client.user.id).status, {
          name: suffix
        })
        msg.channel.createMessage(`Set status to ${suffix}`)
      } else {
        bot.editStatus('online', null)
        msg.channel.createMessage('Cleared status.')
      }
    }
  }
}
