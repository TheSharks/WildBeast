const request = require('superagent')

module.exports = {
  meta: {
    help: 'Returns a gif displaying yes or no',
    timeout: 5,
    level: 0
  },
  fn: function (msg, suffix) {
    request.get('http://yesno.wtf/api/')
      .query({force: suffix})
      .end((err, res) => {
        if (!err && res.status === 200) {
          msg.channel.createMessage(`<@${msg.author.id}>, ${res.body.image}`)
        } else {
          logger.error(`Got an error: ${err}, status code: ${res.status}`)
        }
      })
  }
}
