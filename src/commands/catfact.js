const request = require('superagent')

module.exports = {
  meta: {
    help: 'Get a cat fact.',
    module: 'Fun',
    level: 0,
    timeout: 10,
    alias: ['catfacts']
  },
  fn: function (msg) {
    request.get('https://catfact.ninja/fact')
      .end((err, res) => {
        if (!err && res.status === 200) {
          msg.channel.createMessage(res.body.fact)
        } else {
          global.i18n.send('API_ERROR', msg.channel)
          global.logger.error(`REST call failed: ${err}`)
        }
      })
  }
}
