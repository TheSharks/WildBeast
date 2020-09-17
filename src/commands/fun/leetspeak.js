const map = {
  a: '4',
  e: '3',
  f: 'ph',
  g: '9',
  l: '1',
  o: '0',
  s: '5',
  t: '7',
  y: '`/'
}

const Command = require('../../classes/Command')

module.exports = new Command(function (msg, suffix) {
  if (!suffix) return this.safeSendMessage(msg.channel, i18n.t('commands.leetspeak.errors.suffixMissing'))
  this.safeSendMessage(msg.channel, translate(suffix))
}, {
  aliases: ['leetspeek', 'leetspeech', 'leet']
})

function translate (string) {
  for (const y in map) {
    string = string.replace(new RegExp(y, 'g'), map[y])
  }
  return string
}
