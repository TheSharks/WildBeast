const Command = require('../../classes/Command')

module.exports = new Command(async function (msg, suffix) {
  const SA = require('superagent')
  try {
    const res = await SA.get('http://xkcd.com/info.0.json')
    if (suffix.toLowerCase() === 'current') {
      return this.safeSendMessage(msg.channel, getEmbed(res.body))
    }
    let num = parseInt(suffix)
    if (isNaN(num)) {
      num = Math.floor(Math.random() * (res.body.num - 1)) + 1
    } else if (num > res.body.num) {
      return this.safeSendMessage(msg.channel, i18n.t('commands.xkcd.errors.limit', { num: res.body.num }))
    }
    const numRes = await SA.get(`http://xkcd.com/${num}/info.0.json`)
    this.safeSendMessage(msg.channel, getEmbed(numRes.body))
  } catch (error) {
    logger.error('REST XKCD', error)
    this.safeSendMessage(msg.channel, i18n.t('commands.common.softFail'))
  }
})

function getEmbed (body) {
  return {
    embed: {
      url: `https://xkcd.com/${body.num}/`,
      title: body.safe_title,
      color: 0x202225,
      image: {
        url: body.img
      },
      footer: {
        text: body.alt
      }
    }
  }
}
