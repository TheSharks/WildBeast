var list = {}
var time = {}
var status = {}
var temp
var type
var count
var YT = require('youtube-dl')
var Logger = require('./logger.js').Logger
var Config = require('../../config.json')

exports.join = function (msg, suffix, bot) {
  if (bot.VoiceConnections.length > 10) {
    msg.channel.sendMessage('Sorry, all streaming slots are taken, try again later. :cry:')
  } else {
    var voiceCheck = bot.VoiceConnections.find((r) => r.voiceConnection.guild.id === msg.guild.id)
    if (!voiceCheck && !suffix) {
      var VC = msg.member.getVoiceChannel()
      if (VC) {
        VC.join().then((vc) => {
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
      } else if (!VC) {
        msg.guild.voiceChannels[0].join().then((vc) => {
          msg.channel.sendMessage('I joined channel **' + vc.voiceConnection.channel.name + '** because you did not specify a channel for me to join. \nYou have until the end of the wait music to request something.')
          status[msg.guild.id] = true
          time[msg.guild.id] = setTimeout(function () {
            leave(bot, msg)
            status[msg.guild.id] = false
          }, 199000)
          waiting(vc)
        }).catch((err) => {
          if (err.message === 'Missing permission') {
            msg.reply("I could not the first voice channel in my list because I don't have `Connect` permissions :cry:")
          }
        })
      }
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

exports.leave = function (msg, suffix, bot) {
  leave(bot, msg)
}

function waiting (vc) {
  var waitMusic = vc.voiceConnection.createExternalEncoder({
    type: 'ffmpeg',
    source: 'Fanta.mp3', // Caps sensitive why
    format: 'pcm'
  })
  waitMusic.play()
}

function next (msg, suffix, bot) {
  bot.VoiceConnections
    .map((connection) => {
      if (connection.voiceConnection.guild.id === msg.guild.id) {
        if (list[msg.guild.id].link.length === 0) {
          msg.channel.sendMessage('Playlist has ended, leaving voice.')
          connection.voiceConnection.disconnect()
          return
        }
        var encoder = connection.voiceConnection.createExternalEncoder({
          type: 'ffmpeg',
          format: 'pcm',
          source: list[msg.guild.id].link[0]
        })
        encoder.play()
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
      }
    })
}

exports.volume = function (msg, suffix, bot) {
  if (!isNaN(suffix) && suffix <= 100 && suffix > 0) {
    bot.VoiceConnections
      .map((connection) => {
        if (connection.voiceConnection.guild.id === msg.guild.id) {
          list[msg.guild.id].volume = parseInt(suffix)
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
  type = setInterval(function () {
    msg.channel.sendTyping()
  }, 5000)
  if (query.list && query.list.length > 8 && link.host.indexOf('youtu') > -1) {
    msg.channel.sendMessage('Playlist fetching might take a while...')
    var api = require('youtube-api')
    api.authenticate({
      type: 'key',
      key: Config.api_keys.google
    })
    api.playlistItems.list({
      part: 'snippet',
      pageToken: [],
      maxResults: 50,
      playlistId: query.list
    }, function (err, data) {
      if (err) {
        msg.channel.sendMessage('Something went wrong while requesting information about this playlist.')
        Logger.error('Playlist failiure, ' + err)
        clearInterval(type)
        return
      } else if (data) {
        temp = data.items
        count = data.items.length
        safeLoop(msg, suffix, bot)
      }
    })
  } else {
    fetch(suffix, msg).then((r) => {
      msg.channel.sendMessage(`Added **${r.title}** to the playlist.`)
      if (r.autoplay === true) {
        next(msg, suffix, bot)
      }
      clearInterval(type)
    }).catch(() => {
      msg.channel.sendMessage("I couldn't add that to the playlist.")
      clearInterval(type)
    })
  }
}

function fetch (v, msg, stats) {
  return new Promise(function (resolve, reject) {
    var video = YT(v)
    var x
    var y = 1
    if (stats) {
      x = stats
    }
    video.on('info', (i) => {
      y++
      if (list[msg.guild.id] === undefined || list[msg.guild.id].link.length < 1) {
        list[msg.guild.id] = {
          link: [i.url],
          info: [i.title],
          volume: 100,
          requester: [msg.author.username]
        }
        if (y > x) {
          return resolve({
            title: i.title,
            autoplay: true,
            done: true
          })
        } else {
          return resolve({
            title: i.title,
            autoplay: true
          })
        }
      } else {
        list[msg.guild.id].link.push(i.url)
        list[msg.guild.id].info.push(i.title)
        list[msg.guild.id].requester.push(msg.author.username)
        if (y > x) {
          return resolve({
            title: i.title,
            autoplay: false,
            done: true
          })
        } else {
          return resolve({
            title: i.title,
            autoplay: false
          })
        }
      }
    })
    video.on('error', (e) => {
      y++
      if (y > x) {
        return reject({
          error: e,
          done: true
        })
      } else {
        return reject({
          error: e
        })
      }
    })
  })
}

function safeLoop (msg, suffix, bot) {
  fetch('https://youtube.com/watch?v=' + temp[0].snippet.resourceId.videoId, msg, temp.length).then((r) => {
    if (r.autoplay) {
      msg.channel.sendMessage('Autoplaying **' + r.title + '**')
      next(msg, suffix, bot)
    }
    if (r.done) {
      msg.channel.sendMessage(`Added ${count} videos to the queue.`)
      clearInterval(type)
    } else {
      temp.shift()
      safeLoop(msg)
    }
  }).catch((e) => {
    Logger.error('Playlist debug, ' + e.error)
    if (e.done) {
      msg.channel.sendMessage(`Added ${count} videos to the queue.`)
      clearInterval(type)
    } else {
      temp.shift()
      safeLoop(msg)
    }
  })
}
