const Command = require('../../classes/Command')

module.exports = new Command(msg => {
  const request = require('superagent')
  request.get('https://uselessfacts.jsph.pl/random.json?language=en')
    .then(res => {
      if (res.statusCode !== 200 || !res.body.text) return msg.channel.createMessage('Something went wrong!')
      return msg.channel.createMessage(res.body.text)
    })
})
