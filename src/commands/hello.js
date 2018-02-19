module.exports = {
  meta: {
    level: 0,
    alias: ['github'],
    help: 'I\'ll say hello and return my github link!'
  },
  fn: function (msg) {
    msg.channel.createMessage(`Hi ${msg.author.username}, I'm ${msg.channel.guild.shard.client.user.username} and I was developed by the team over at TheSharks! Improve me by contributing to my source code on GitHub: https://github.com/TheSharks/WildBeast`)
  }
}
