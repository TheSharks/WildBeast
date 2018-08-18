const request = require('superagent')

module.exports = {
  meta: {
    help: 'Insult someone in a fancy manner.',
    module: 'Fun',
    level: 0,
    timeout: 5,
    alias: ['insult']
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
          global.i18n.send('API_ERROR', msg.channel)
          global.logger.error(`REST call failed: ${err}`)
        }
      })
  }
}
