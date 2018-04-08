const {guildInfo, getPlayer} = require('../internal/encoder-selector.js')
module.exports = {
  meta: {
    level: 1,
    timeout: 0,
    module: 'Music',
    alias: ['vol'],
    noDM: true,
    help: ''
  },
  fn: (msg, suffix) => {
    if (global.bot.voiceConnections.get(msg.channel.guild.id)) {
      if (!suffix) {
        global.i18n.send('VOLUME_NO_SUFFIX', msg.channel, {volume: guildInfo[msg.channel.guild.id].volume})
      } else if (isNaN(suffix) || suffix > 100 || suffix < 0) {
        global.i18n.send('VOLUME_SUFFIX_MALFORMED', msg.channel)
      } else {
        getPlayer(msg.channel.guild.channels.find(c => c.id === global.bot.voiceConnections.get(msg.channel.guild.id).channelId)).then(player => {
          guildInfo[msg.channel.guild.id].volume = suffix
          player.setVolume(suffix)
          global.i18n.send('VOLUME_ADJUSTED', msg.channel, {volume: suffix})
        }).catch(console.error)
      }
    } else {
      global.i18n.send('VOICE_NOT_CONNECTED', msg.channel)
    }
  }
}
