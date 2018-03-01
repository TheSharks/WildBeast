const SA = require('superagent')

module.exports = {
  meta: {
    level: 0,
    timeout: 5,
    alias: [],
    help: "I'll check if a streamer is live on twitch.tv"
  },
  fn: (msg, suffix) => {
    if (!suffix) {
      msg.channel.createMessage('No channel specified!')
    } else {
      SA.get(`https://api.twitch.tv/kraken/streams/${suffix}`)
        .set({'Accept': 'application/vnd.twitchtv.v3+json', 'Client-ID': process.env.TWITCH_ID})
        .end((err, response) => {
          if (err) global.logger.error(err)
          else if (!response.body) msg.channel.createMessage('The API returned an unconventional response.')
          else if (response.body.stream !== null) msg.channel.createMessage(`**${suffix}** is currently live at <https://twitch.tv/${suffix}>.`)
          else if (response.body.stream === null) msg.channel.createMessage(`**${suffix}** is not currently streaming.`)
          else if (!err && response.statusCode === 404) msg.channel.createMessage(`**${suffix}** isn't a valid channel.`)
        })
    }
  }
}
