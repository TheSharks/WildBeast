module.exports = {
  meta: {
    help: 'Make the bot leave the current server.',
    module: 'Admin',
    level: 10,
    noDM: true,
    alias: ['leave-server', 'bye']
  },
  fn: async (msg) => {
    await msg.channel.createMessage('Goodbye.')
    msg.channel.guild.leave()
  }
}
