const { guildInfo, hhMMss } = require('../selectors/encoder-selector.js')
module.exports = {
  meta: {
    help: 'Show the playback queue.',
    module: 'Music',
    level: 1,
    noDM: true,
    alias: ['list']
  },
  fn: async (msg) => {
    if (global.bot.voiceConnections.get(msg.channel.guild.id)) {
      if (guildInfo[msg.channel.guild.id].tracks.length === 0) {
        global.i18n.send('QUEUE_EMPTY', msg.channel)
      } else {
        const arr = []
        for (let i = 1; i < guildInfo[msg.channel.guild.id].tracks.length; i++) {
          const trackTitle = guildInfo[msg.channel.guild.id].tracks[i].info.title
          const trackLength = guildInfo[msg.channel.guild.id].tracks[i].info.length / 1000
          const trackRequester = msg.channel.guild.members.get(guildInfo[msg.channel.guild.id].tracks[i].requester)
          arr.push(`**${i}**. **${trackTitle}** [${await hhMMss(trackLength)}] ${global.i18n.raw('TRACK_REQUESTED_BY', { user: trackRequester ? trackRequester.user.username : 'Unknown user' })}`) // In case user is not in guild
          if (i === 10) {
            if (guildInfo[msg.channel.guild.id].tracks.length - 11 !== 0) {
              arr.push(global.i18n.raw('MORE_SONGS', { count: guildInfo[msg.channel.guild.id].tracks.length - 11 }))
            }
            break
          }
        }
        const requester = msg.channel.guild.members.get(guildInfo[msg.channel.guild.id].tracks[0].requester)
        msg.channel.createMessage(await global.i18n.raw('QUEUE_LIST', {
          current: guildInfo[msg.channel.guild.id].tracks[0].info.title,
          duration: await hhMMss(guildInfo[msg.channel.guild.id].tracks[0].info.length / 1000),
          user: requester ? requester.user.username : 'Unknown user', // In case user is not in guild
          list: arr.join('\n')
        }))
      }
    } else {
      global.i18n.send('VOICE_NOT_CONNECTED', msg.channel)
    }
  }
}
