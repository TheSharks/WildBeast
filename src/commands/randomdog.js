const request = require('superagent')

module.exports = {
  meta: {
    help: 'Get a random dog picture.',
    module: 'Fun',
    level: 0,
    timeout: 10,
    alias: ['doggo', 'dog']
  },
  fn: function (msg) {
    request.get('https://random.dog/woof.json')
      .end((err, res) => {
        if (!err && res.status === 200) {
          msg.channel.createMessage(res.body.url)
        } else {
          global.i18n.send('API_ERROR', msg.channel)
          global.logger.error(`REST call failed: ${err}`)
        }
      })
  }
}
