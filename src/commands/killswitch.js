module.exports = {
  meta: {
    level: Infinity,
    timeout: 0,
    alias: ['kill'],
    help: 'Instantly terminates the bot process.'
  },
  fn: async (msg) => {
    await msg.channel.createMessage('Bye.')
    global.bot.disconnect()
    process.exit(0)
  }
}
