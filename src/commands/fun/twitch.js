const Command = require('../../classes/Command')

module.exports = new Command(async function (msg, suffix) {
  const SA = require('superagent')
  if (!suffix) return this.safeSendMessage(msg.channel, i18n.t('commands.twitch.errors.noChannel'))
  try {
    const res = await SA.get(`https://api.twitch.tv/kraken/users?login=${suffix}`)
      .set({ Accept: 'application/vnd.twitchtv.v5+json', 'Client-ID': process.env.TWITCH_ID })
    const user = res.body._total
      ? res.body.users[0]._id
      : false
    if (!user) return this.safeSendMessage(msg.channel, i18n.t('commands.twitch.errors.invalidChannel', { channel: suffix }))
    const stream = await SA.get(`https://api.twitch.tv/kraken/streams/${user}`)
      .set({ Accept: 'application/vnd.twitchtv.v5+json', 'Client-ID': process.env.TWITCH_ID })
    stream.body.stream
      ? this.safeSendMessage(msg.channel, getEmbed(stream.body))
      : this.safeSendMessage(msg.channel, i18n.t('commands.twitch.offline', { channel: suffix }))
  } catch (error) {
    logger.error('REST TWITCH', error)
    return this.safeSendMessage(msg.channel, i18n.t('commands.common.softFail'))
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
    content: i18n.t('commands.twitch.online', { channel: name }),
    embed: {
      url: `https://twitch.tv/${name}`,
      title: stream.channel.status,
      color: 0x9013FE,
      fields: [{
        name: i18n.t('commands.twitch.game'),
        value: stream.game,
        inline: true
      }, {
        name: i18n.t('commands.twitch.viewers'),
        value: stream.viewers,
        inline: true
      }, {
        name: i18n.t('commands.twitch.views'),
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
