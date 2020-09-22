const Command = require('../../classes/Command')

module.exports = new Command(async function (msg) {
  const SA = require('superagent')
  try {
    const res = await SA.get('https://inspirobot.me/api?generate=true')
    // sanity check
    new URL(res.text) // eslint-disable-line
    await this.safeSendMessage(msg.channel, {
      embed: {
        image: {
          url: res.text
        },
        footer: {
          text: 'inspirobot.me',
          icon_url: 'https://inspirobot.me/website/images/inspirobot-dark-green.png'
        },
        color: 0x1a6607
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
  timeouts: {
    channel: 1250
  },
  nsfw: true
})
