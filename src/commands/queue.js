const {guildInfo, hhMMss} = require('../internal/encoder-selector.js')
module.exports = {
  meta: {
    level: 1,
    timeout: 0,
    alias: ['list'],
    help: 'Show current playback queue',
    noDM: true,
    module: 'Music'
  },
  fn: async (msg) => {
    if (global.bot.voiceConnections.get(msg.channel.guild.id)) {
      if (guildInfo[msg.channel.guild.id].tracks.length === 0) {
        global.i18n.send('QUEUE_EMPTY', msg.channel)
      } else {
        let arr = []
        for (let i = 1; i < guildInfo[msg.channel.guild.id].tracks.length; i++) {
          arr.push(`**${i}**. **${guildInfo[msg.channel.guild.id].tracks[i].info.title}** [${await hhMMss(guildInfo[msg.channel.guild.id].tracks[i].info.length / 1000)}] ${global.i18n.raw('TRACK_REQUESTED_BY', {user: msg.channel.guild.members.get(guildInfo[msg.channel.guild.id].tracks[i].requester).user.username})}`)
          if (i === 10) {
            if (guildInfo[msg.channel.guild.id].tracks.length - 11 !== 0) {
              arr.push(global.i18n.raw('MORE_SONGS', {count: guildInfo[msg.channel.guild.id].tracks.length - 11}))
            }
            break
          }
        }
        msg.channel.createMessage(await global.i18n.raw('QUEUE_LIST', {
          current: guildInfo[msg.channel.guild.id].tracks[0].info.title,
          duration: await hhMMss(guildInfo[msg.channel.guild.id].tracks[0].info.length / 1000),
          user: msg.channel.guild.members.get(guildInfo[msg.channel.guild.id].tracks[0].requester).user.username,
          list: arr.join('\n')
        }))
      }
    } else {
      global.i18n.send('VOICE_NOT_CONNECTED', msg.channel)
    }
  }
}
