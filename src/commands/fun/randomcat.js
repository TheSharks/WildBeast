const SA = require('superagent')
const Command = require('../../classes/Command')

module.exports = new Command(async msg => {
  try {
    const res = await SA.get('http://aws.random.cat/meow')
    await msg.channel.createMessage({
      embed: {
        image: {
          url: res.body.url
        },
        footer: {
          text: 'random.cat'
        }
      }
    })
  } catch (e) {
    msg.channel.createMessage('Something went wrong, try again later')
    logger.error(e)
  }
})
