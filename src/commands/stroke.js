const request = require('superagent')

module.exports = {
  meta: {
    help: 'I\'ll stroke someones ego!',
    timeout: 5,
    level: 0
  },
  fn: function (msg, suffix) {
    var name
    if (suffix) {
      name = suffix.split('"')
      if (name.length === 1) {
        name = ['', name]
      }
    } else {
      name = ['Jake', 'Heinz'] // I'm not sorry b1nzy <3
    }
    request.get('http://api.icndb.com/jokes/random')
      .query({escape: 'javascript'})
      .query({firstName: name[0]})
      .query({lastName: name[1]})
      .end((err, res) => {
        if (!err && res.status === 200) {
          msg.channel.createMessage(res.body.value.joke)
        } else {
          logger.error(`Got an error: ${err}, status code: ${res.status}`)
        }
      })
  }
}
