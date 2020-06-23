const Command = require('../../classes/Command')

module.exports = new Command(async (msg, suffix) => {
  const SA = require('superagent')
  try {
    if (!suffix) return msg.channel.createMessage('Please enter a search term')
    const res = await SA.get('http://api.urbandictionary.com/v0/define')
      .query({ term: suffix })
    if (res.body.list.length < 1) return msg.channel.createMessage("This word is so screwed up, even Urban Dictionary doesn't know it")
    const ctx = res.body.list[0]
    await msg.channel.createMessage({
      embed: {
        color: 0x6832e3,
        author: {
          name: 'Urban Dictionary'
        },
        title: ctx.word,
        url: ctx.permalink,
        description: ctx.definition.length > 2000 ? ctx.definition.substring(0, 2000) + '[...]' : ctx.definition,
        fields: [
          {
            name: 'Example',
            value: ctx.example.length > 1000 ? ctx.example.substring(0, 1000) + '[...]' : ctx.example
          }
        ]
      }
    })
  } catch (e) {
    msg.channel.createMessage('Something went wrong, try again later')
    logger.error('CMD', e)
  }
}, {
  clientPerms: {
    channel: ['embedLinks']
  },
  aliases: ['ud'],
  nsfw: true
})
