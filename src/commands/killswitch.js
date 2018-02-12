module.exports = {
  meta: {
    level: Infinity,
    timeout: 0,
    alias: ['kill'],
    help: 'Instantly terminates the bot process.'
  },
  fn: (msg) => {
    msg.channel.createMessage('Bye.')
    msg.channel.guild.shard.client.disconnect()
    process.exit(0)
  }
}
