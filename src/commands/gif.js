const request = require('superagent')

module.exports = {
  meta: {
    help: 'Search Giphy for a gif.',
    usage: '<search query>',
    module: 'Fun',
    level: 0,
    timeout: 5
  },
  fn: function (msg, suffix) {
    request
      .get('http://api.giphy.com/v1/gifs/random')
      .set('api_key', 'dc6zaTOxFJmzC')
      .query({rating: msg.channel.nsfw === true ? 'r' : 'pg13', fmt: 'json'})
      .query(`tag=${encodeURIComponent(suffix.split(' ').join('+'))}`)
      .then(res => {
        if (res.statusCode !== 200 || res.body.meta.status !== 200) return global.i18n.send('API_ERROR', msg.channel)
        if (res.body.data.id !== undefined) {
          return msg.channel.createMessage(`http://media.giphy.com/media/${res.body.data.id}/giphy.gif`)
        } else {
          return global.i18n.send('BOORU_NO_RESULTS', msg.channel, {query: suffix})
        }
      })
  }
}
