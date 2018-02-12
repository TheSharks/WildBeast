const request = require('superagent')

module.exports = {
  meta: {
    help: 'I\'ll get a random cat image for you!',
    alias: ['cat'],
    timeout: 10,
    level: 0
  },
  fn: function (msg) {
    request.get('http://random.cat/meow')
      .end((err, res) => {
        if (!err && res.status === 200) {
          msg.channel.createMessage(res.body.file)
        } else {
          global.logger.error(`REST call failed: ${err}`)
        }
      })
  }
}
