module.exports = {
  meta: {
    level: 0,
    timeout: 0,
    alias: [],
    help: "I'll reply with pong to test my responsiveness."
  },
  fn: (msg) => {
    let start = new Date(msg.timestamp)
    msg.channel.createMessage('Pong!').then(c => {
      c.edit(`Pong! \`${Math.floor(new Date(c.timestamp) - start)}ms, ${global.bot.shards.random().latency}ms\``) // whatever, latency is pretty consistent across shards anyway
    })
  }
}
