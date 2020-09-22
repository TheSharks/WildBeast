const Command = require('../../classes/Command')

module.exports = new Command(function (msg) {
  const request = require('superagent')
  request.get('https://uselessfacts.jsph.pl/random.json?language=en')
    .then(res => {
      if (res.statusCode !== 200 || !res.body.text) return this.safeSendMessage(msg.channel, i18n.t('commands.common.softFail'))
      return this.safeSendMessage(msg.channel, res.body.text)
    })
})
