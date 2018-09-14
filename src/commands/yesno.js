const request = require('superagent')

module.exports = {
  meta: {
    help: 'Get a GIF saying yes or no.',
    module: 'Fun',
    level: 0,
    timeout: 5
  },
  fn: function (msg, suffix) {
    request.get('http://yesno.wtf/api/')
      .query({ force: suffix })
      .end((err, res) => {
        if (!err && res.status === 200) {
          msg.channel.createMessage(`<@${msg.author.id}>, ${res.body.image}`)
        } else {
          global.i18n.send('API_ERROR', msg.channel)
          global.logger.error(`REST call failed: ${err}`)
        }
      })
  }
}
