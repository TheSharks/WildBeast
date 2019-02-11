const { pause, guildInfo } = require('../selectors/encoder-selector.js')
module.exports = {
  meta: {
    help: 'Pause the playback of the current track.',
    module: 'Music',
    level: 1,
    noDM: true
  },
  fn: async (msg) => {
    if (global.bot.voiceConnections.get(msg.channel.guild.id)) {
      if (guildInfo[msg.channel.guild.id].paused === false) {
        await pause(msg.channel)
        guildInfo[msg.channel.guild.id].paused = true
        global.i18n.send('MUSIC_PAUSE', msg.channel)
      } else {
        global.i18n.send('MUSIC_PAUSED', msg.channel)
      }
    } else {
      global.i18n.send('VOICE_NOT_CONNECTED', msg.channel)
    }
  }
}
