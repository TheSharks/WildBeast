module.exports = {
  meta: {
    help: 'Return the bot\'s pseudo-ping.',
    module: 'Util',
    level: 0
  },
  fn: (msg) => {
    let start = new Date(msg.timestamp)
    msg.channel.createMessage('Pong!').then(c => {
      c.edit(`Pong! \`${Math.floor(new Date(c.timestamp) - start)}ms, ${global.bot.shards.random().latency}ms\``) // whatever, latency is pretty consistent across shards anyway
    })
  }
}
