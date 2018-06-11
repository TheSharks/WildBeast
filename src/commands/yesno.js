const request = require('superagent')

module.exports = {
  meta: {
    help: 'Returns a gif displaying yes or no',
    timeout: 5,
    module: 'Fun',
    level: 0
  },
  fn: function (msg, suffix) {
    request.get('http://yesno.wtf/api/')
      .query({force: suffix})
      .end((err, res) => {
        if (!err && res.status === 200) {
          msg.channel.createMessage(`<@${msg.author.id}>, ${res.body.image}`)
        } else {
          global.logger.error(`REST call failed: ${err}`)
        }
      })
  }
}
