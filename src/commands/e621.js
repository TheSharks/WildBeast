module.exports = {
  meta: {
    help: 'Query e621 for an image.',
    usage: '<search query>',
    module: 'Porn',
    level: 0,
    timeout: 1,
    nsfw: true,
    alias: ['e6']
  },
  fn: (msg, suffix) => {
    // we do this for legacy reasons
    return require('./booru').fn(msg, 'e621 ' + suffix)
  }
}
