const request = require('superagent')

module.exports = {
  meta: {
    help: 'Get a random yo momma joke',
    module: 'Fun',
    level: 0,
    timeout: 5
  },
  fn: function (msg) {
    request.get('http://api.yomomma.info/')
      .end((err, res) => {
        if (!err && res.status === 200) {
          try {
            JSON.parse(res.text)
          } catch (e) {
            global.i18n.send('API_ERROR', msg.channel)
            return
          }
          const joke = JSON.parse(res.text)
          msg.channel.createMessage(joke.joke)
        } else {
          global.i18n.send('API_ERROR', msg.channel)
          global.logger.error(`REST call failed: ${err}`)
        }
      })
  }
}
