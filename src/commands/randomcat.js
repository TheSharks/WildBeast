const request = require('superagent')

module.exports = {
  meta: {
    help: 'Get a random cat picture.',
    module: 'Fun',
    level: 0,
    timeout: 10,
    alias: ['cat']
  },
  fn: function (msg) {
    request.get('http://aws.random.cat/meow')
      .end((err, res) => {
        if (!err && res.status === 200) {
          msg.channel.createMessage(res.body.file)
        } else {
          global.logger.error(`REST call failed: ${err}`)
        }
      })
  }
}
