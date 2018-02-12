const request = require('superagent')

module.exports = {
  meta: {
    name: 'dice',
    help: 'I\'ll roll some dice!',
    timeout: 5,
    level: 0
  },
  fn: function (msg, suffix) {
    var dice
    if (suffix) {
      dice = suffix
    } else {
      dice = 'd6'
    }
    request.get('https://rolz.org/api/?' + dice + '.json')
      .end((err, res) => {
        if (!err && res.status === 200) {
          var roll = res.body
          msg.channel.createMessage(`<@${msg.author.id}>, Your ${roll.input} resulted in ${roll.result}${roll.details}`)
        } else {
          console.error(`Got an error: ${err}, status code: ${res.status}`)
        }
      })
  }
}
