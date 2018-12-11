const { guildInfo, setVolume } = require('../selectors/encoder-selector.js')
module.exports = {
  meta: {
    help: 'Change the playback volume.',
    usage: '<0-100>',
    module: 'Music',
    level: 1,
    noDM: true,
    alias: ['vol']
  },
  fn: async (msg, suffix) => {
    if (global.bot.voiceConnections.get(msg.channel.guild.id)) {
      if (!suffix) {
        global.i18n.send('VOLUME_NO_SUFFIX', msg.channel, { volume: guildInfo[msg.channel.guild.id].volume })
      } else if (isNaN(suffix) || suffix > 100 || suffix < 0) {
        global.i18n.send('VOLUME_SUFFIX_MALFORMED', msg.channel)
      } else {
        guildInfo[msg.channel.guild.id].volume = suffix
        await setVolume(msg.channel, suffix)
        global.i18n.send('VOLUME_ADJUSTED', msg.channel, { volume: suffix })
      }
    } else {
      global.i18n.send('VOICE_NOT_CONNECTED', msg.channel)
    }
  }
}
