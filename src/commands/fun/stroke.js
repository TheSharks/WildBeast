const Command = require('../../classes/Command')

module.exports = new Command(msg => {
  const request = require('superagent')
  request.get('https://api.icndb.com/jokes/random')
    .query({ escape: 'javascript' })
    .then(res => {
      if (res.statusCode !== 200) return msg.channel.createMessage('Something went wrong!')
      return msg.channel.createMessage(res.body.value.joke)
    })
})
