const {guildInfo, hhMMss, getPlayer} = require('../internal/encoder-selector.js')
module.exports = {
  meta: {
    level: 1,
    timeout: 0,
    alias: ['np'],
    help: 'succ',
    noDM: true,
    module: 'Music'
  },
  fn: async (msg) => {
    if (global.bot.voiceConnections.get(msg.channel.guild.id)) {
      if (guildInfo[msg.channel.guild.id].tracks.length >= 1) {
        global.i18n.send('NOW_PLAYING', msg.channel, {
          current: guildInfo[msg.channel.guild.id].tracks[0].info.title,
          duration: await hhMMss(guildInfo[msg.channel.guild.id].tracks[0].info.length / 1000),
          url: guildInfo[msg.channel.guild.id].tracks[0].info.uri,
          state: guildInfo[msg.channel.guild.id].paused === false ? ':arrow_forward:' : ':pause_button:',
          progress: await progressBar(await getPlayer(msg.channel).then(p => p.getTimestamp()) / guildInfo[msg.channel.guild.id].tracks[0].info.length)
        })
      } else {
        global.i18n.send('QUEUE_EMPTY', msg.channel)
      }
    } else {
      global.i18n.send('VOICE_NOT_CONNECTED', msg.channel)
    }
  }
}

async function progressBar (percent) {
  let str = ''
  for (let i = 0; i < 12; i++) {
    if (i === (Math.floor(percent * 12))) {
      str += '\uD83D\uDD18'
    } else {
      str += '▬'
    }
  }
  return str
}
