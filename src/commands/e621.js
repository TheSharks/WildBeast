module.exports = {
  meta: {
    level: 0,
    timeout: 1,
    nsfw: true,
    alias: ['e6'],
    help: 'e621 my dude',
    module: 'Porn'
  },
  fn: (msg, suffix) => {
    // we do this for legacy reasons
    return require('./booru').fn(msg, 'e621 ' + suffix)
  }
}
