const request = require('superagent')

module.exports = {
  meta: {
    help: 'Get a dog fact.',
    module: 'Fun',
    level: 0,
    timeout: 10,
    alias: ['dogfacts']
  },
  fn: function (msg) {
    request.get('https://dog-api.kinduff.com/api/facts')
      .end((err, res) => {
        if (!err && res.status === 200) {
          msg.channel.createMessage(res.body.facts[0])
        } else {
          global.logger.error(`REST call failed: ${err}`)
        }
      })
  }
}
