module.exports = {
  meta: {
    help: 'Query rule34 for an image.',
    usage: '<search query>',
    module: 'Porn',
    level: 0,
    timeout: 1,
    nsfw: true,
    alias: ['r34']
  },
  fn: (msg, suffix) => {
    // we do this for legacy reasons
    return require('./booru').fn(msg, 'rule34 ' + suffix)
  }
}
