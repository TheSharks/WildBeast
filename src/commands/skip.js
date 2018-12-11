const { guildInfo, hhMMss, skip, stop } = require('../selectors/encoder-selector.js')
module.exports = {
  meta: {
    help: 'Skip the current track.',
    module: 'Music',
    level: 1,
    noDM: true,
    alias: ['next']
  },
  fn: async (msg) => {
    if (global.bot.voiceConnections.get(msg.channel.guild.id)) {
      guildInfo[msg.channel.guild.id].endedEarly = true
      if (guildInfo[msg.channel.guild.id].tracks.length > 1) {
        const trackRequester = msg.channel.guild.members.find(m => m.id === guildInfo[msg.channel.guild.id].tracks[1].requester)
        global.i18n.send('SKIP_TRACK', msg.channel, {
          current: guildInfo[msg.channel.guild.id].tracks[0].info.title,
          next: guildInfo[msg.channel.guild.id].tracks[1].info.title,
          duration: await hhMMss(guildInfo[msg.channel.guild.id].tracks[1].info.length / 1000),
          user: trackRequester ? trackRequester.username : 'Unknown user' // In case user is not in guild
        })
        await skip(msg)
      } else if (guildInfo[msg.channel.guild.id].tracks.length <= 1) {
        await stop(msg)
      }
    } else {
      global.i18n.send('VOICE_NOT_CONNECTED', msg.channel)
    }
  }
}
