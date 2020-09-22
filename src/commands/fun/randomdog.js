const Command = require('../../classes/Command')

module.exports = new Command(async function (msg) {
  const SA = require('superagent')
  try {
    const res = await SA.get('https://random.dog/woof.json?filter=mp4,webm')
    const { fact } = (await SA.get('https://some-random-api.ml/facts/dog')).body
    await this.safeSendMessage(msg.channel, {
      embed: {
        description: fact,
        image: {
          url: res.body.url
        },
        footer: {
          text: 'random.dog'
        }
      }
    })
  } catch (e) {
    this.safeSendMessage(msg.channel, i18n.t('commands.common.softFail'))
    logger.error('CMD', e)
  }
}, {
  clientPerms: {
    channel: ['embedLinks']
  },
  aliases: ['dog']
})
