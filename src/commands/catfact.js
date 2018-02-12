const request = require('superagent')

module.exports = {
  meta: {
    help: 'I\'ll give you some interesting catfacts!',
    alias: ['catfacts'],
    timeout: 10,
    level: 0
  },
  fn: function (msg) {
    request.get('https://catfact.ninja/fact')
      .end((err, res) => {
        if (!err && res.status === 200) {
          msg.channel.createMessage(res.body.fact)
        } else {
          logger.error(`Got an error: ${err}, status code: ${res.status}`)
        }
      })
  }
}
