const {guildInfo} = require('../internal/encoder-selector.js')
module.exports = {
  meta: {
    level: 1,
    timeout: 0,
    alias: [],
    help: 'succ',
    noDM: true,
    module: 'Music'
  },
  fn: async (msg) => {
    if (global.bot.voiceConnections.get(msg.channel.guild.id)) {
      if (guildInfo[msg.channel.guild.id].tracks.length === 0) {
        global.i18n.send('QUEUE_EMPTY', msg.channel)
      } else {
        let currentIndex = guildInfo[msg.channel.guild.id].tracks.length
        let temporaryValue
        let randomIndex
        while (currentIndex !== 0) {
          randomIndex = Math.floor(Math.random() * currentIndex)
          currentIndex -= 1
          if (currentIndex !== 0 && randomIndex !== 0) {
            temporaryValue = guildInfo[msg.channel.guild.id].tracks[currentIndex]
            guildInfo[msg.channel.guild.id].tracks[currentIndex] = guildInfo[msg.channel.guild.id].tracks[randomIndex]
            guildInfo[msg.channel.guild.id].tracks[randomIndex] = temporaryValue
          }
        }
        global.i18n.send('QUEUE_SHUFFLED', msg.channel)
      }
    } else {
      global.i18n.send('VOICE_NOT_CONNECTED', msg.channel)
    }
  }
}
