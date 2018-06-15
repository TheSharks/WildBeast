const {guildInfo} = require('../internal/encoder-selector.js')
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
      global.i18n.send('VOICE_DISCONNECT', msg.channel, {channel: msg.channel.guild.channels.find(c => c.id === global.bot.voiceConnections.get(msg.channel.guild.id).channelId).name})
      global.bot.leaveVoiceChannel(global.bot.voiceConnections.get(msg.channel.guild.id).channelId)
      guildInfo[msg.channel.guild.id] = undefined
    } else {
      global.i18n.send('VOICE_NOT_CONNECTED', msg.channel)
    }
  }
}
