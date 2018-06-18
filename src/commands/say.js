module.exports = {
  meta: {
    help: 'Make the bot send a message of your choice.',
    usage: '<message>',
    module: 'Util',
    level: 0
  },
  fn: (msg, suffix) => {
    msg.channel.createMessage('\u200B' + suffix) // eris does escaping for us
  }
}
