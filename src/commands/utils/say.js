const Command = require('../../classes/Command')

module.exports = new Command(function (msg, suffix) {
  this.safeSendMessage(msg.channel, '\u200B' + suffix) // eris does escaping for us
})
