const request = require('superagent')

module.exports = {
  meta: {
    help: 'I\'ll insult your friends!',
    alias: ['insult'],
    timeout: 5,
    module: 'Fun',
    level: 0
  },
  fn: function (msg, suffix) {
    request.get('http://quandyfactory.com/insult/json/')
      .end((err, res) => {
        if (!err && res.status === 200) {
          const fancyinsult = res.body
          if (suffix === '') {
            msg.channel.createMessage(fancyinsult.insult)
          } else {
            msg.channel.createMessage(suffix + ', ' + fancyinsult.insult)
          }
        } else {
          global.logger.error(`REST call failed: ${err}`)
        }
      })
  }
}
