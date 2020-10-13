const Command = require('../../classes/Command')

module.exports = new Command(function (msg, suffix) {
  if (suffix) {
    const reg = /([0-9]{1,2})d([0-9]+)/
    if (!reg.test(suffix)) return this.safeSendMessage(msg.channel, i18n.t('commands.dice.badSyntax'))
    const chunks = suffix.match(reg)
    const result = []
    while (chunks[1] !== 0) {
      result.push(Math.floor(Math.random() * chunks[2]) + 1)
      chunks[1]--
    }
    const explaination = result.join(' + ')
    return this.safeSendMessage(msg.channel, i18n.t('commands.dice.resultMany', {
      result: result.reduce((a, b) => a + b, 0),
      explaination: (explaination.length > 1500 ? i18n.t('commands.dice.resultTooLong') : explaination)
    }))
  } else {
    // assume 1d6
    return this.safeSendMessage(msg.channel, i18n.t('commands.dice.resultSingle', { result: Math.floor(Math.random() * 6) + 1 }))
  }
})
