'use strict'
var v = require('../internal/voice.js')
var Commands = []

Commands.pauseplay = {
  name: 'pauseplay',
  help: "I'll pause/play the music!",
  timeout: 10,
  level: 0,
  fn: function (msg, suffix, bot) {
    v.pausePlay(msg, suffix, bot)
  }
}

Commands.volume = {
  name: 'volume',
  help: "I'll change my volume!",
  timeout: 10,
  level: 0,
  fn: function (msg, suffix, bot) {
    v.volume(msg, suffix, bot)
  }
}

Commands.skip = {
  name: 'skip',
  help: "I'll skip this song if you don't like it.",
  timeout: 10,
  level: 0,
  fn: function (msg, suffix, bot) {
    v.skip(msg, suffix, bot)
  }
}

Commands.playlist = {
  name: 'playlist',
  help: "I'll fetch you the playlsit I'm currently playing!",
  timeout: 10,
  level: 0,
  fn: function (msg) {
    v.fetchList(msg).then((r) => {
      var arr = []
      arr.push('Now playing: **' + r.info[0] + '** \n')
      for (var i = 1; i < r.info.length; i++) {
        arr.push((i + 1) + '. **' + r.info[i] + '** Requested by ' + r.requester[i])
        if (i === 9) {
          arr.push('And about ' + (r.info.length - 10) + ' more songs.')
          break
        }
      }
      msg.channel.sendMessage(arr.join('\n'))
    }).catch(() => {
      msg.channel.sendMessage("It seems that I don't have a playlist for this server.")
    })
  }
}

Commands.voice = {
  name: 'voice',
  help: "I'll join a voice channel!",
  timeout: 10,
  level: 0,
  fn: function (msg, suffix, bot) {
    v.join(msg, suffix, bot)
  }
}

Commands.request = {
  name: 'request',
  help: 'Use this to request songs!',
  usage: 'Youtube-link',
  timeout: 10,
  level: 0,
  fn: function (msg, suffix, bot) {
    v.request(msg, suffix, bot)
  }
}

exports.Commands = Commands
