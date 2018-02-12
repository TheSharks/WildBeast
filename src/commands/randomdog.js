const request = require('superagent')

module.exports = {
  meta: {
    help: 'I\'ll get a random doggo image for you!',
    alias: ['doggo', 'dog'],
    timeout: 10,
    level: 0
  },
  fn: function (msg) {
    request.get('https://random.dog/woof.json')
      .end((err, res) => {
        if (!err && res.status === 200) {
          msg.channel.createMessage(res.body.url)
        } else {
          logger.error(`Got an error: ${err}, status code: ${res.status}`)
        }
      })
  }
}
