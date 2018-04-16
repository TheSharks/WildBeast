const {pause, guildInfo} = require('../internal/encoder-selector.js')
module.exports = {
  meta: {
    level: 1,
    timeout: 0,
    alias: [],
    noDM: true,
    help: 'succ',
    module: 'Music'
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
