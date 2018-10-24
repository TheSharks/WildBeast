const { guildInfo } = require('../selectors/encoder-selector.js')
module.exports = {
  meta: {
    help: 'Shuffle the playback queue.',
    module: 'Music',
    level: 1,
    noDM: true
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
