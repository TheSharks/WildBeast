const request = require('superagent')

module.exports = {
  meta: {
    help: 'I\'ll get a random yomomma joke for you!',
    timeout: 5,
    level: 0
  },
  fn: function (msg) {
    request.get('http://api.yomomma.info/')
      .end((err, res) => {
        if (!err && res.status === 200) {
          try {
            JSON.parse(res.text)
          } catch (e) {
            msg.channel.createMessage('The API returned an unconventional response.')
            return
          }
          var joke = JSON.parse(res.text)
          msg.channel.createMessage(joke.joke)
        } else {
          console.error(`Got an error: ${err}, status code: ${res.status}`)
        }
      })
  }
}
