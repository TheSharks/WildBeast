const SA = require('superagent')
const Command = require('../../classes/Command')

module.exports = new Command(async msg => {
  try {
    const res = await SA.get('https://random.dog/woof.json?filter=mp4,webm')
    await msg.channel.createMessage({
      embed: {
        image: {
          url: res.body.url
        },
        footer: {
          text: 'random.dog'
        }
      }
    })
  } catch (e) {
    msg.channel.createMessage('Something went wrong, try again later')
    logger.error(e)
  }
})
