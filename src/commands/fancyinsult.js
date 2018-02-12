const request = require('superagent')

module.exports = {
  meta: {
    help: 'I\'ll insult your friends!',
    alias: ['insult'],
    timeout: 5,
    level: 0
  },
  fn: function (msg, suffix) {
    request.get('http://quandyfactory.com/insult/json/')
      .end((err, res) => {
        if (!err && res.status === 200) {
          var fancyinsult = res.body
          if (suffix === '') {
            msg.channel.createMessage(fancyinsult.insult)
          } else {
            msg.channel.createMessage(suffix + ', ' + fancyinsult.insult)
          }
        } else {
          logger.error(`Got an error: ${err}, status code: ${res.status}`)
        }
      })
  }
}
