module.exports = {
  meta: {
    level: 0,
    timeout: 0,
    alias: [],
    module: 'Util',
    help: 'Repeat after me.'
  },
  fn: (msg, suffix) => {
    msg.channel.createMessage('\u200B' + suffix) // eris does escaping for us
  }
}
