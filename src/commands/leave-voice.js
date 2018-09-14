const { leaveVoiceChannel } = require('../internal/encoder-selector.js')
module.exports = {
  meta: {
    help: 'Make the bot leave the current voice channel.',
    module: 'Music',
    level: 1,
    noDM: true,
    alias: ['stop']
  },
  fn: async (msg) => {
    if (global.bot.voiceConnections.get(msg.channel.guild.id)) {
      await leaveVoiceChannel(msg)
    } else {
      global.i18n.send('VOICE_NOT_CONNECTED', msg.channel)
    }
  }
}
