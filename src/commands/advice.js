const request = require('superagent')

module.exports = {
  meta: {
    help: 'I\'ll give you some fantastic advice!',
    noDM: true,
    timeout: 5,
    level: 0
  },
  fn: function (msg) {
    request.get('http://api.adviceslip.com/advice')
      .end((err, res) => {
        if (!err && res.status === 200) {
          try {
            JSON.parse(res.text)
          } catch (e) {
            msg.channel.createMessage('The API returned an unconventional response.')
            return
          }
          var advice = JSON.parse(res.text)
          msg.channel.createMessage(advice.slip.advice)
        } else {
          console.error(`Got an error: ${err}, status code: ${res.status}`)
        }
      })
  }
}
