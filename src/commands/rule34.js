module.exports = {
  meta: {
    level: 0,
    timeout: 1,
    nsfw: true,
    alias: ['r34'],
    module: 'Porn',
    help: 'If it exists, there is porn of it'
  },
  fn: (msg, suffix) => {
    // we do this for legacy reasons
    return require('./booru').fn(msg, 'rule34 ' + suffix)
  }
}
