const map = {
  'a': '4',
  'e': '3',
  'f': 'ph',
  'g': '9',
  'l': '1',
  'o': '0',
  's': '5',
  't': '7',
  'y': '`/'
}

module.exports = {
  meta: {
    help: 'Encode a message into l337sp3@K.',
    module: 'Fun',
    level: 0,
    alias: ['leetspeek', 'leetspeech', 'leet']
  },
  fn: function (msg, suffix) {
    if (suffix.length > 0) {
      const thing = translate(suffix)
      msg.channel.createMessage(`<@${msg.author.id}>, ${thing}`)
    } else {
      msg.channel.createMessage(`<@${msg.author.id}>, *You need to type something to encode your message into l337sp3@K!*`)
    }
  }
}

function translate (string) {
  for (const y in map) {
    string = string.replace(new RegExp(y, 'g'), map[y])
  }
  return string
}
