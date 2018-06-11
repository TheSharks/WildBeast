const answers = [
  'Signs point to yes.',
  'Yes.',
  'Reply hazy, try again.',
  'Without a doubt.',
  'My sources say no.',
  'As I see it, yes.',
  'You may rely on it.',
  'Concentrate and ask again.',
  'Outlook not so good.',
  'It is decidedly so.',
  'Better not tell you now.',
  'Very doubtful.',
  'Yes - definitely.',
  'It is certain.',
  'Cannot predict now.',
  'Most likely.',
  'Ask again later.',
  'My reply is no.',
  'Outlook good.',
  'Don\'t count on it.',
  'Who cares?',
  'Never, ever, ever.',
  'Possibly.',
  'There is a small chance.'
]

module.exports = {
  meta: {
    help: 'I\'ll make a prediction using a Magic 8 Ball',
    alias: ['8ball'],
    timeout: 5,
    module: 'Fun',
    level: 0
  },
  fn: function (msg, suffix) {
    if (!suffix) {
      msg.channel.createMessage(`<@${msg.author.id}>, I mean I can shake this 8ball all I want but without a question it's kinda dumb.`)
      return
    }
    msg.channel.createMessage('The Magic 8 Ball says:\n```' + answerShuffle(answers)[0] + '```')

    function answerShuffle (array) {
      let rand
      let index = -1
      let length = array.length
      let result = Array(length)
      while (++index < length) {
        rand = Math.floor(Math.random() * (index + 1))
        result[index] = result[rand]
        result[rand] = array[index]
      }
      return (result)
    }
  }
}
