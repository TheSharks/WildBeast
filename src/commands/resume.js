const { resume, guildInfo } = require('../selectors/encoder-selector.js')
module.exports = {
  meta: {
    help: 'Resume the playback of the current track.',
    module: 'Music',
    level: 1,
    noDM: true
  },
  fn: async (msg) => {
    if (global.bot.voiceConnections.get(msg.channel.guild.id)) {
      if (guildInfo[msg.channel.guild.id].paused === true) {
        await resume(msg.channel)
        guildInfo[msg.channel.guild.id].paused = false
        global.i18n.send('MUSIC_RESUME', msg.channel)
      } else {
        global.i18n.send('MUSIC_PLAYING', msg.channel)
      }
    } else {
      global.i18n.send('VOICE_NOT_CONNECTED', msg.channel)
    }
  }
}
