var list = {}
var time = {}
var status = {}
var YT = require('youtube-dl')
var Logger = require('./logger.js').Logger
var Config = require('../../config.json')

exports.join = function (msg, suffix, bot) {
  if (bot.VoiceConnections.length > 10) {
    msg.channel.sendMessage('Sorry, all streaming slots are taken, try again later. :cry:')
  } else {
    var voiceCheck = bot.VoiceConnections.find((r) => r.voiceConnection.guild.id === msg.guild.id)
    if (!voiceCheck && !suffix) {
      msg.member.getVoiceChannel().join().then((vc) => {
        msg.channel.sendMessage('I joined channel **' + vc.voiceConnection.channel.name + '** which I believe you are currently in. \nYou have until the end of the wait music to request something.')
        status[msg.guild.id] = true
        time[msg.guild.id] = setTimeout(function () {
          leave(bot, msg)
          status[msg.guild.id] = false
        }, 199000)
        waiting(vc)
      }).catch((err) => {
        if (err.message === 'Missing permission') {
          msg.reply("I could not join the channel you're in because I don't have `Connect` permissions :cry:")
        }
      })
    } else if (!voiceCheck) {
      msg.channel.guild.voiceChannels
        .forEach((channel) => {
          if (channel.name.toLowerCase().indexOf(suffix.toLowerCase()) >= 0) {
            channel.join().then((vc) => {
              msg.channel.sendMessage('I joined **' + vc.voiceConnection.channel.name + '** \nYou have until the end of the wait music to request something.!')
              status[msg.guild.id] = true
              time[msg.guild.id] = setTimeout(function () {
                leave(bot, msg)
                status[msg.guild.id] = false
              }, 199000)
              waiting(vc)
            }).catch((err) => {
              if (err.message === 'Missing permission') {
                msg.reply('Could not join channel as I do not have `Connect` permissions.')
              }
            })
          }
        })
    } else {
      msg.reply('I am already streaming on this server in channel **' + voiceCheck.voiceConnection.channel.name + '**')
    }
  }
}

function leave (bot, msg) {
  if (status[msg.guild.id] === true) {
    msg.channel.sendMessage('Nothing has been added to the playlist during the wait time, leaving voice!')
    var voice = bot.VoiceConnections.find((r) => r.voiceConnection.guild.id === msg.guild.id)
    if (voice) {
      voice.voiceConnection.getEncoder().kill()
      voice.voiceConnection.disconnect()
      list[msg.guild.id] = {
        link: [],
        info: [],
        requester: []
      }
    }
  }
}

function waiting (vc) {
  var waitMusic = vc.voiceConnection.createExternalEncoder({
    type: 'ffmpeg',
    source: 'fanta.mp3',
    format: 'pcm'
  })
  waitMusic.play()
}

function next (msg, suffix, bot) {
  bot.VoiceConnections
    .map((connection) => {
      if (connection.voiceConnection.guild.id === msg.guild.id) {
        var encoder = connection.voiceConnection.createExternalEncoder({
          type: 'ffmpeg',
          format: 'pcm',
          source: list[msg.guild.id].link[0]
        })
        var vol = (list[msg.guild.id].volume !== undefined) ? list[msg.guild.id].volume : 100
        connection.voiceConnection.getEncoder().setVolume(vol)
        encoder.once('end', () => {
          msg.channel.sendMessage('**' + list[msg.guild.id].info[0] + '** has ended!')
          list[msg.guild.id].link.shift()
          list[msg.guild.id].info.shift()
          list[msg.guild.id].requester.shift()
          if (list[msg.guild.id].link.length > 0) {
            msg.channel.sendMessage('Next up is **' + list[msg.guild.id].info[0] + '** requested by _' + list[msg.guild.id].requester[0] + '_')
            next(msg, suffix, bot)
          } else {
            msg.channel.sendMessage('Playlist has ended, leaving voice.')
            connection.voiceConnection.disconnect()
          }
        })
        encoder.play()
      }
    })
}

exports.volume = function (msg, suffix, bot) {
  if (!isNaN(suffix) && suffix <= 100 && suffix > 0) {
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
  var connect = bot.VoiceConnections
    .filter(function (connection) {
      return connection.voiceConnection.guild.id === msg.guild.id
    })
  if (connect.length < 1) {
    msg.channel.sendMessage("I'm not connected to any voice channel in this server, try initializing me with the command `voice` first!")
    return
  }
  clearTimeout(time[msg.guild.id])
  var link = require('url').parse(suffix)
  var query = require('querystring').parse(link.query)
  msg.channel.sendTyping()
  var type = setInterval(function () {
    msg.channel.sendTyping()
  }, 5000)
  if (query.list && link.host.indexOf('youtu') > -1) {
    var c = 0
    var g = 0
    var api = require('youtube-api')
    api.authenticate({
      type: 'key',
      key: Config.api_keys.google
    })
    api.playlistItems.list({
      part: 'snippet',
      pageToken: [],
      maxResults: 30,
      playlistId: query.list
    }, function (err, data) {
      if (err) {
        Logger.debug('Playlist failiure, ' + err)
        return
      } else if (data) {
        c = data.items.length
        for (var x in data.items) {
          var vid = YT('https://youtube.com/watch?v=' + data.items[x].snippet.resourceId.videoId)
          vid.on('error', (e) => {
            Logger.debug('Playlist debug, ' + e)
          })
          vid.on('info', (i) => {
            g++
            if (list[msg.guild.id] === undefined || list[msg.guild.id].link.length < 1) {
              list[msg.guild.id] = {
                link: [i.url],
                info: [i.title],
                volume: 100,
                requester: [msg.author.username]
              }
              if (g >= c) {
                msg.channel.sendMessage(`Added ${c} videos to the queue.`)
                clearInterval(type)
                next(msg, suffix, bot)
              }
            } else {
              list[msg.guild.id].link.push(i.url)
              list[msg.guild.id].info.push(i.title)
              list[msg.guild.id].requester.push(msg.author.username)
              if (g >= c) {
                msg.channel.sendMessage(`Added ${c} videos to the queue.`)
                clearInterval(type)
                next(msg, suffix, bot)
              }
            }
          })
        }
      }
    })
  } else {
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
}
