const request = require('superagent')

module.exports = {
  meta: {
    help: 'Get a random XKCD comic, or supply a number to get that particular comic.',
    usage: '[comic number]',
    module: 'Fun',
    level: 0,
    timeout: 10
  },
  fn: function (msg, suffix) {
    let xkcdInfo
    request.get('http://xkcd.com/info.0.json')
      .end((error, response) => {
        if (!error && response.status === 200) {
          xkcdInfo = response.body
          if (suffix.toLowerCase() === 'current') {
            msg.channel.createMessage(`<@${msg.author.id}>, **Alternate text (shown on mouse over)**\n ${xkcdInfo.alt}\n\n${xkcdInfo.img}`)
          } else if (!suffix) {
            const xkcdRandom = Math.floor(Math.random() * (xkcdInfo.num - 1)) + 1
            request.get(`http://xkcd.com/${xkcdRandom}/info.0.json`)
              .end((error, response) => {
                if (!error && response.status === 200) {
                  xkcdInfo = response.body
                  msg.channel.createMessage(`<@${msg.author.id}>, **Alternate text (shown on mouse over)**\n ${xkcdInfo.alt}\n\n${xkcdInfo.img}`)
                } else {
                  msg.channel.createMessage(`<@${msg.author.id}>, Please try again later.`)
                  global.logger.error(`REST call failed: ${error}`)
                }
              })
          } else if (!isNaN(parseInt(suffix, 10)) && parseInt(suffix, 10) > 0 && (parseInt(suffix, 10) <= xkcdInfo.num)) {
            request(`http://xkcd.com/${suffix}/info.0.json`)
              .end((error, response) => {
                if (!error && response.status === 200) {
                  xkcdInfo = response.body
                  msg.channel.createMessage(`<@${msg.author.id}>, **Alternate text (shown on mouse over)**\n ${xkcdInfo.alt}\n\n${xkcdInfo.img}`)
                } else {
                  msg.channel.createMessage(`<@${msg.author.id}>, Please try again later.`)
                  global.logger.error(`REST call failed: ${error}`)
                }
              })
          } else {
            msg.channel.createMessage(`<@${msg.author.id}>, There are only ${xkcdInfo.num} xkcd comics!`)
          }
        } else {
          msg.channel.createMessage(`<@${msg.author.id}>, Please try again later.`)
          global.logger.error(`REST call failed: ${error}`)
        }
      })
  }
}
