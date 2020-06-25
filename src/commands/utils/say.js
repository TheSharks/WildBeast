const Command = require('../../classes/Command')

module.exports = new Command((msg, suffix) => {
  msg.channel.createMessage('\u200B' + suffix) // eris does escaping for us
})
