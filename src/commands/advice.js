const request = require('superagent')

module.exports = {
  meta: {
    help: 'Get some clever advice.',
    module: 'Fun',
    level: 0,
    timeout: 5,
    noDM: true
  },
  fn: function (msg) {
    request.get('http://api.adviceslip.com/advice')
      .end((err, res) => {
        if (!err && res.status === 200) {
          try {
            JSON.parse(res.text)
          } catch (e) {
            global.i18n.send('API_ERROR', msg.channel)
            return
          }
          const advice = JSON.parse(res.text)
          msg.channel.createMessage(advice.slip.advice)
        } else {
          global.i18n.send('API_ERROR', msg.channel)
          global.logger.error(`REST call failed: ${err}, status code: ${res.status}`)
        }
      })
  }
}
