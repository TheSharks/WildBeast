const Command = require('../../classes/Command')

module.exports = new Command(function (msg) {
  const request = require('superagent')
  request.get('https://api.yomomma.info/')
    .then(res => {
      if (res.status !== 200) return this.safeSendMessage(msg.channel, 'Something went wrong!')
      try {
        const ctx = JSON.parse(res.text)
        this.safeSendMessage(msg.channel, ctx.joke)
      } catch (_) {
        return this.safeSendMessage(msg.channel, 'Something went wrong!')
      }
    })
})
