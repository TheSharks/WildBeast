const Command = require('../../classes/Command')

module.exports = new Command(async msg => {
  const request = require('superagent')
  const res = await request.get('https://api.adviceslip.com/advice')
  try {
    const advice = (JSON.parse(res.text)).slip.advice
    msg.channel.createMessage(advice)
  } catch (e) {
    logger.error(e)
    msg.channel.createMessage('Something went wrong!')
  }
})
