const Command = require('../../classes/Command')

module.exports = new Command(msg => {
  const request = require('superagent')
  request.get('https://api.yomomma.info/')
    .then(res => {
      if (res.status !== 200) return msg.channel.createMessage('Something went wrong!')
      try {
        const ctx = JSON.parse(res.text)
        msg.channel.createMessage(ctx.joke)
      } catch (_) {
        return msg.channel.createMessage('Something went wrong!')
      }
    })
})
