const Command = require('../../classes/Command')

module.exports = new Command(function (msg) {
  this.safeSendMessage(msg.channel, i18n.t('commands.8ball.prefix', {
    response: i18n.t(`commands.8ball.choices.${Math.floor(Math.random() * 24)}`)
  }))
})
