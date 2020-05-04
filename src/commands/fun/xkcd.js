const SA = require('superagent')
const Command = require('../../classes/Command')

module.exports = new Command(async (msg, suffix) => {
  try {
    const res = await SA.get('http://xkcd.com/info.0.json')
    if (suffix.toLowerCase() === 'current') {
      return msg.channel.createMessage(getEmbed(res.body))
    }
    let num = parseInt(suffix)
    if (isNaN(num)) {
      num = Math.floor(Math.random() * (res.body.num - 1)) + 1
    } else if (num > res.body.num) {
      return msg.channel.createMessage(`There are only ${res.body.num} xkcd comics!`)
    }
    const numRes = await SA.get(`http://xkcd.com/${num}/info.0.json`)
    msg.channel.createMessage(getEmbed(numRes.body))
  } catch (error) {
    logger.error('REST XKCD', error)
    msg.channel.createMessage('We ran into an error making that request, sorry about that!')
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
