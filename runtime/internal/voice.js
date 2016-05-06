var list = {}
var YT = require('youtube-dl')
var Logger = require('./logger.js').Logger

exports.join = function (msg, suffix) {
  if (list[msg.guild.id]) {
    list[msg.guild.id] = undefined
  }
  msg.guild.voiceChannels
    .forEach((channel) => {
      if (channel.name.toLowerCase().indexOf(suffix.toLowerCase()) > -1) {
        channel.join().then((r) => {
          var encoder = r.voiceConnection.createExternalEncoder({
            type: 'ffmpeg',
            format: 'pcm',
            debug: false,
            source: 'Fanta.mp3'
          })
          encoder.play()
          return
        }).catch((e) => {
          Logger.debug('Join-voice debug: ' + e)
        })
      }
    })
}

function next (msg, suffix, bot) {
  bot.VoiceConnections
    .map((connection) => {
      if (connection.voiceConnection.guild.id === msg.guild.id) {
        var encoder = connection.voiceConnection.createExternalEncoder({
          type: 'ffmpeg',
          format: 'pcm',
          debug: false,
          source: list[msg.guild.id].link[0]
        })
        encoder.play()
        if (list[msg.guild.id].volume !== 100) {
          connection.voiceConnection.getEncoder().setVolume(list[msg.guild.id].volume)
        }
        encoder.once('end', () => {
          list[msg.guild.id].link.shift()
          list[msg.guild.id].info.shift()
          list[msg.guild.id].requester.shift()
          if (list[msg.guild.id].link.length > 0) {
            next(msg, suffix, bot)
          } else {
            msg.channel.sendMessage('Ended')
            connection.voiceConnection.disconnect()
          }
        })
      }
    })
}

exports.volume = function (msg, suffix, bot) {
  if (!isNaN(suffix) || suffix <= 100) {
    bot.VoiceConnections
      .map((connection) => {
        if (connection.voiceConnection.guild.id === msg.guild.id) {
          list[msg.guild.id].volume = suffix
          connection.voiceConnection.getEncoder().setVolume(suffix)
        }
      })
  } else {
    msg.channel.sendMessage('**WHAT**')
  }
}

exports.skip = function (msg, suffix, bot) {
  list[msg.guild.id].link.shift()
  list[msg.guild.id].info.shift()
  list[msg.guild.id].requester.shift()
  next(msg, suffix, bot)
}

exports.pausePlay = function (msg, suffix, bot) {
  bot.VoiceConnections
    .map((connection) => {
      if (connection.voiceConnection.guild.id === msg.guild.id) {
        if (suffix.toLowerCase() === 'pause') {
          connection.voiceConnection.getEncoderStream().cork()
        } else if (suffix.toLowerCase() === 'play') {
          connection.voiceConnection.getEncoderStream().uncork()
        } else {
          msg.channel.sendMessage('**WHAT**')
        }
      }
    })
}

exports.fetchList = function (msg) {
  return new Promise(function (resolve, reject) {
    try {
      resolve(list[msg.guild.id])
    } catch (e) {
      reject(e)
    }
  })
}

exports.request = function (msg, suffix, bot) {
  msg.channel.sendTyping()
  var type = setInterval(function () {
    msg.channel.sendTyping()
  }, 5000)
  var video = YT(suffix)
  video.on('error', (e) => {
    Logger.debug('Request error: ' + e)
    msg.channel.sendMessage('Stuff happened, I failed to fetch a valid AV file, try again with something different!')
    clearInterval(type)
    return
  })
  video.on('info', (i) => {
    if (list[msg.guild.id] === undefined || list[msg.guild.id].link.length < 1) {
      list[msg.guild.id] = {
        link: [i.url],
        info: [i.title],
        volume: 100,
        requester: [msg.author.username]
      }
      msg.channel.sendMessage(`Added **${i.title}** to the queue`)
      clearInterval(type)
      next(msg, suffix, bot)
    } else {
      list[msg.guild.id].link.push(i.url)
      list[msg.guild.id].info.push(i.title)
      list[msg.guild.id].requester.push(msg.author.username)
      clearInterval(type)
      msg.channel.sendMessage(`Added **${i.title}** to the queue`)
    }
  })
}
