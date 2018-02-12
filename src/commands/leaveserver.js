module.exports = {
  meta: {
    level: Infinity,
    timeout: 0,
    alias: ['leave-server', 'bye', 'leave'],
    help: 'I\'ll leave the server that this is sent in.'
  },
  fn: (msg) => {
    if (!msg.channel.guild) msg.channel.createMessage('You cannot do this in a DM!')
    else {
      msg.channel.createMessage('Goodbye.')
      msg.channel.guild.leave()
    }
  }
}
