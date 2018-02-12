module.exports = {
  meta: {
    level: 10,
    timeout: 0,
    alias: ['leave-server', 'bye', 'leave'],
    help: 'I\'ll leave the server that this is sent in.'
  },
  fn: async (msg) => {
    await msg.channel.createMessage('Goodbye.')
    msg.channel.guild.leave()
  }
}
