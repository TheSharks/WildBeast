const {guildInfo, hhMMss, skip} = require('../internal/encoder-selector.js')
module.exports = {
  meta: {
    level: 1,
    timeout: 0,
    alias: ['next'],
    noDM: true,
    module: 'Music',
    help: 'succ'
  },
  fn: async (msg) => {
    if (global.bot.voiceConnections.get(msg.channel.guild.id)) {
      if (guildInfo[msg.channel.guild.id].tracks.length > 1) {
        global.i18n.send('SKIP_TRACK', msg.channel, {
          current: guildInfo[msg.channel.guild.id].tracks[0].info.title,
          next: guildInfo[msg.channel.guild.id].tracks[1].info.title,
          duration: await hhMMss(guildInfo[msg.channel.guild.id].tracks[1].info.length / 1000),
          user: msg.channel.guild.members.find(m => m.id === guildInfo[msg.channel.guild.id].tracks[1].requester).username
        })
        skip(msg)
      } else if (guildInfo[msg.channel.guild.id].tracks.length <= 1) {
        if (!process.env.WILDBEAST_VOICE_PERSIST) {
          global.bot.leaveVoiceChannel(global.bot.voiceConnections.get(msg.channel.guild.id).channelId)
          guildInfo[msg.channel.guild.id] = undefined
          global.i18n.send('QUEUE_END', msg.channel)
        } else {
          guildInfo[msg.channel.guild.id].tracks.shift()
          guildInfo[msg.channel.guild.id].skips = []
          global.i18n.send('VOICE_PERSIST', msg.channel)
        }
      }
    } else {
      global.i18n.send('VOICE_NOT_CONNECTED', msg.channel)
    }
  }
}
