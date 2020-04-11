const SA = require('superagent')
const Command = require('../../classes/Command')

module.exports = new Command(async msg => {
  try {
    const res = await SA.get('https://aws.random.cat/meow')
    const fact = (await SA.get('https://catfact.ninja/fact')).body.fact
    await msg.channel.createMessage({
      embed: {
        description: fact,
        image: {
          url: res.body.file
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
}, {
  ownPermsNeeded: ['embedLinks'],
  aliases: ['cat']
})
