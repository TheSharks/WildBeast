const request = require('superagent')

module.exports = {
  meta: {
    name: 'dice',
    help: 'Roll the dice.',
    timeout: 5,
    module: 'Fun',
    level: 0
  },
  fn: function (msg, suffix) {
    let dice
    if (suffix) {
      dice = suffix
    } else {
      dice = 'd6'
    }
    request.get('https://rolz.org/api/?' + dice + '.json')
      .end((err, res) => {
        if (!err && res.status === 200) {
          const roll = res.body
          msg.channel.createMessage(`<@${msg.author.id}>, Your ${roll.input} resulted in ${roll.result}${roll.details}`)
        } else {
          global.i18n.send('API_ERROR', msg.channel)
          global.logger.error(`REST call failed: ${err}`)
        }
      })
  }
}
