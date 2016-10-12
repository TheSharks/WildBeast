          type: 'ffmpeg',
          format: 'pcm',
          source: list[msg.guild.id].link[0]
        })
        encoder.play()
        var vol = (list[msg.guild.id].volume !== undefined) ? list[msg.guild.id].volume : 100
        connection.voiceConnection.getEncoder().setVolume(vol)
        encoder.once('end', () => {
          msg.channel.sendMessage('**' + list[msg.guild.id].info[0] + '** has ended!').then((m) => {
            if (config.autodeletemsg) {
              setTimeout(() => {
                m.delete().catch((e) => Logger.error(e))
              }, config.deleteTimeout)
            }
          })
          list[msg.guild.id].link.shift()
          list[msg.guild.id].info.shift()
          list[msg.guild.id].requester.shift()
          list[msg.guild.id].skips.count = 0
          list[msg.guild.id].skips.users = []
          if (list[msg.guild.id].link.length > 0) {
            msg.channel.sendMessage('Next up is **' + list[msg.guild.id].info[0] + '** requested by _' + list[msg.guild.id].requester[0] + '_').then((m) => {
              if (config.autodeletemsg) {
                setTimeout(() => {
                  m.delete().catch((e) => Logger.error(e))
                }, config.deleteTimeoutLong)
              }
            })
            next(msg, suffix, bot)
          } else {
            msg.channel.sendMessage('Playlist has ended, leaving voice.').then((m) => {
              if (config.autodeletemsg) {
                setTimeout(() => {
                  m.delete().catch((e) => Logger.error(e))
                }, config.deleteTimeout)
              }
            })
            connection.voiceConnection.disconnect()
          }
        })
      }
    })
}

exports.shuffle = function (msg) {
  var currentIndex = list[msg.guild.id].link.length
  var temporaryValue
  var randomIndex
  while (currentIndex !== 0) {
    randomIndex = Math.floor(Math.random() * currentIndex)
    currentIndex -= 1
    if (currentIndex !== 0 && randomIndex !== 0) {
      temporaryValue = list[msg.guild.id].link[currentIndex]
      list[msg.guild.id].link[currentIndex] = list[msg.guild.id].link[randomIndex]
      list[msg.guild.id].link[randomIndex] = temporaryValue
      temporaryValue = list[msg.guild.id].info[currentIndex]
      list[msg.guild.id].info[currentIndex] = list[msg.guild.id].info[randomIndex]
      list[msg.guild.id].info[randomIndex] = temporaryValue
      temporaryValue = list[msg.guild.id].requester[currentIndex]
      list[msg.guild.id].requester[currentIndex] = list[msg.guild.id].requester[randomIndex]
      list[msg.guild.id].requester[randomIndex] = temporaryValue
    }
