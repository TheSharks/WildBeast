module.exports = {
  meta: {
    help: '1\'Ll 3nc0d3 Y0uR Me5s@g3 1Nt0 l337sp3@K!',
    alias: ['leetspeek', 'leetspeech', 'leet'],
    module: 'Fun',
    level: 0
  },
  fn: function (msg, suffix) {
    if (suffix.length > 0) {
      const leetspeak = require('leetspeak')
      const thing = leetspeak(suffix)
      msg.channel.createMessage(`<@${msg.author.id}>, ${thing}`)
    } else {
      msg.channel.createMessage(`<@${msg.author.id}>, *You need to type something to encode your message into l337sp3@K!*`)
    }
  }
}
