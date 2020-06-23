const Command = require('../../classes/Command')

module.exports = new Command(async (msg, suffix) => {
  const SA = require('superagent')
  if (!suffix) return msg.channel.createMessage('No channel specified!')
  try {
    const res = await SA.get(`https://api.twitch.tv/kraken/users?login=${suffix}`)
      .set({ Accept: 'application/vnd.twitchtv.v5+json', 'Client-ID': process.env.TWITCH_ID })
    const user = res.body._total
      ? res.body.users[0]._id
      : false
    if (!user) return msg.channel.createMessage(`**${suffix}** isn't a valid channel.`)
    const stream = await SA.get(`https://api.twitch.tv/kraken/streams/${user}`)
      .set({ Accept: 'application/vnd.twitchtv.v5+json', 'Client-ID': process.env.TWITCH_ID })
    stream.body.stream
      ? msg.channel.createMessage(getEmbed(stream.body))
      : msg.channel.createMessage(`**${suffix}** is not currently streaming.`)
  } catch (error) {
    logger.error('REST TWITCH', error)
    return msg.channel.createMessage('We ran into an error making that request, sorry about that!')
  }
},
{
  aliases: ['tw'],
  clientPerms: {
    channel: ['embedLinks']
  }
})

function getEmbed (resp) {
  const stream = resp.stream
  const name = resp.stream.channel.display_name
  return {
    content: `**${name}** is currently live at <https://twitch.tv/${name}>.`,
    embed: {
      url: `https://twitch.tv/${name}`,
      title: stream.channel.status,
      color: 0x9013FE,
      fields: [{
        name: 'Game',
        value: stream.game,
        inline: true
      }, {
        name: 'Viewers',
        value: stream.viewers,
        inline: true
      }, {
        name: 'Total Views',
        value: stream.channel.views,
        inline: true
      }],
      image: {
        url: stream.preview.large
      },
      thumbnail: {
        url: stream.channel.logo
      }
    }
  }
}
