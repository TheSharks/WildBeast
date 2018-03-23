const {guildInfo} = require('../internal/encoder-selector.js')
module.exports = {
  meta: {
    level: 1,
    timeout: 0,
    alias: ['stop'],
    noDM: true,
    help: 'succ'
  },
  fn: async (msg) => {
    if (global.bot.voiceConnections.get(msg.channel.guild.id)) {
      global.i18n.send('VOICE_DISCONNECT', msg.channel, {channel: msg.channel.guild.channels.find(c => c.id === global.bot.voiceConnections.get(msg.channel.guild.id).channelId).name})
      global.bot.leaveVoiceChannel(global.bot.voiceConnections.get(msg.channel.guild.id).channelId)
      delete guildInfo[msg.channel.guild.id]
    } else {
      global.i18n.send('VOICE_NOT_CONNECTED', msg.channel)
    }
  }
}