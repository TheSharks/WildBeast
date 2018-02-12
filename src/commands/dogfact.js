const request = require('superagent')

module.exports = {
  meta: {
    help: 'I\'ll give you some interesting dogfacts!',
    alias: ['dogfacts'],
    timeout: 10,
    level: 0
  },
  fn: function (msg) {
    request.get('https://dog-api.kinduff.com/api/facts')
      .end((err, res) => {
        if (!err && res.status === 200) {
          msg.channel.createMessage(res.body.facts[0])
        } else {
          logger.error(`Got an error: ${err}, status code: ${res.status}`)
        }
      })
  }
}
