const SA = require('superagent')
const Command = require('../../classes/Command')

module.exports = new Command(async (msg, suffix) => {
  const res = await SA.get('http://xkcd.com/info.0.json')
  if(res.error) {
    msg.channel.createMessage(`<@${msg.author.id}>, Please try again later.`)
    global.logger.error(`REST call failed: ${error}`)
  } else {
    if(suffix.toLowerCase() === 'current') {
      return msg.channel.createMessage(`<@${msg.author.id}>, **Alternate text (shown on mouse over)**\n ${res.body.alt}\n\n${res.body.img}`)
    }
    let num = parseInt(suffix)
    if(isNaN(num)) {
      num = Math.floor(Math.random() * (res.body.num - 1)) + 1
    } else if(num > res.body.num) {
      return msg.channel.createMessage(`<@${msg.author.id}>, There are only ${res.body.num} xkcd comics!`)
    }
    SA.get(`http://xkcd.com/${num}/info.0.json`)
      .end((error, response) => {
        if(error) {
          global.logger.error(`REST call failed: ${error}`)
          msg.channel.createMessage(`<@${msg.author.id}>, Please try again later.`)
        } else {
          msg.channel.createMessage(`<@${msg.author.id}>, **Alternate text (shown on mouse over)**\n ${response.body.alt}\n\n${response.body.img}`)
        }
      })
  }
})