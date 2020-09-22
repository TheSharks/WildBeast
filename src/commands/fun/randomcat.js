const Command = require('../../classes/Command')

module.exports = new Command(async function (msg) {
  const SA = require('superagent')
  try {
    const fact = (await SA.get('https://catfact.ninja/fact')).body.fact
    await this.safeSendMessage(msg.channel, {
      embed: {
        description: fact,
        image: {
          url: 'https://cataas.com/cat'
        },
        footer: {
          text: 'cataas.com'
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
  aliases: ['cat']
})
