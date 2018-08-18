const request = require('superagent')

module.exports = {
  meta: {
    help: 'Get a random meme from Imgur.',
    module: 'Fun',
    level: 0,
    nsfw: true // don't know what flag to set
  },
  fn: function (msg) {
    request.get(`https://api.imgur.com/3/g/memes/viral/${Math.floor((Math.random() * 8) + 1)}`) // 20 Memes per page, 160 Memes
      .set('Authorization', 'Client-ID ' + process.env.IMGUR_KEY)
      .end(function (err, result) {
        if (!err && !result.body.data.error) {
          msg.channel.createMessage(result.body.data[Math.floor((Math.random() * 20) + 1)].link)
        } else {
          global.i18n.send('API_ERROR', msg.channel)
          global.logger.error(`REST call failed: ${err}`)
        }
      })
  }
}
