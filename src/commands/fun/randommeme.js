const Command = require('../../classes/Command')

module.exports = new Command(async msg => {
  const SA = require('superagent')
  try {
    const res = await SA.get(`https://api.imgur.com/3/g/memes/viral/${Math.floor((Math.random() * 8) + 1)}`)
      .set('Authorization', 'Client-ID ' + process.env.IMGUR_KEY)
    const ctx = res.body.data[Math.floor((Math.random() * 20))]
    await msg.channel.createMessage({
      embed: {
        url: ctx.link,
        title: ctx.title,
        image: {
          url: ctx.images[0].link
        },
        footer: {
          text: 'imgur.com',
          icon_url: 'https://i.imgur.com/JFa7xb3.png'
          // imgur doesnt have easily accessible versions of their logo
          // improvide, adapt, overcome
        },
        color: 0x1bb76e
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
  nsfw: true
})
