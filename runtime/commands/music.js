'use strict'
var v = require('../internal/voice.js')
var checkLevel = require('../databases/controllers/permissions.js').checkLevel
var Commands = []

Commands.music = {
  name: 'music',
  help: "I'll pause or play the music, just tell me what after the command!",
  aliases: ['pauseplay', 'playpause'],
  noDM: true,
  level: 1,
  fn: function (msg, suffix, bot) {
    v.music(msg, suffix, bot)
  }
}

Commands.volume = {
  name: 'volume',
  help: "I'll change my volume or return the current volume if you don't provide a number!",
  usage: '<nothing/number>',
  aliases: ['vol'],
  noDM: true,
  level: 1,
  fn: function (msg, suffix, bot) {
    v.volume(msg, suffix, bot).then(v => {
      msg.channel.sendMessage(v)
    }).catch(err => {
      msg.channel.sendMessage(err)
    })
  }
}

Commands.voteskip = {
  name: 'voteskip',
  help: 'Vote to skip the current playing song.',
  noDM: true,
  level: 1,
  fn: function (msg, suffix, bot) {
    v.voteSkip(msg, bot)
  }
}

Commands.shuffle = {
  name: 'shuffle',
  help: 'Shuffle the current playlist.',
  noDM: true,
  level: 2,
  fn: function (msg, suffix, bot) {
    v.shuffle(msg, bot)
  }
}

Commands['leave-voice'] = {
  name: 'leave-voice',
  help: "I'll leave the current voice channel.",
  noDM: true,
  level: 1,
  fn: function (msg, suffix, bot) {
    v.leave(msg, suffix, bot)
  }
}

Commands.skip = {
  name: 'skip',
  help: "I'll skip this song if you don't like it.",
  noDM: true,
  level: 2,
  fn: function (msg, suffix, bot) {
    v.skip(msg, suffix, bot)
  }
}

Commands.playlist = {
  name: 'playlist',
  help: "Use delete and a song number to remove it from the list else I will fetch you the playlist I'm currently playing!",
  usage: '<clear/delete/remove> <number>',
  aliases: ['list'],
  noDM: true,
  timeout: 5,
  level: 0,
  fn: function (msg, suffix, bot) {
    suffix = suffix.toLowerCase().split(' ')
    var connect = bot.VoiceConnections.find(v => v.voiceConnection.guild.id === msg.guild.id)
    if (connect) {
      if (suffix[0] !== undefined && ['clear', 'delete', 'remove'].indexOf(suffix[0]) > -1) {
        checkLevel(msg, msg.author.id, msg.member.roles).then(x => {
          if (x >= 1) {
            if (suffix[0] === 'clear') {
              v.deleteFromPlaylist(msg, 'all').then(r => {
                msg.channel.sendMessage(r)
              }).catch(err => {
                msg.channel.sendMessage(err)
              })
            } else {
              v.deleteFromPlaylist(msg, (suffix[1])).then(r => {
                msg.channel.sendMessage(`**${r}** has been removed from the playlist.`)
              }).catch(err => {
                msg.channel.sendMessage(err)
              })
            }
          } else {
            msg.channel.sendMessage('You do not have the required setlevel for this subcommand, check with the server owner if you should be allowed to do this, required level is 1 or higher.')
          }
        })
      } else {
        v.fetchList(msg).then((r) => {
          var arr = []
          arr.push('Now playing: **' + r.info[0] + '** Requested by *' + r.requester[0] + '* \n')
          for (var i = 1; i < r.info.length; i++) {
            arr.push((i) + '. **' + r.info[i] + '** Requested by ' + r.requester[i])
            if (i === 9) {
              if (r.info.length - 10 !== 0) arr.push('And about ' + (r.info.length - 10) + ' more songs.')
              break
            }
          }
          msg.channel.sendMessage(arr.join('\n')).then((m) => {
            setTimeout(() => {
              m.delete()
            }, 30000)
          })
        }).catch(() => {
          msg.channel.sendMessage("It appears that there aren't any songs in the current queue.")
        })
      }
    } else {
      msg.channel.sendMessage('I am not streaming music in this server.')
    }
  }
}

Commands.voice = {
  name: 'voice',
  help: "I'll join a voice channel!",
  aliases: ['join-voice'],
  noDM: true,
  timeout: 10,
  level: 1,
  fn: function (msg, suffix, bot) {
    v.join(msg, suffix, bot)
  }
}

Commands.request = {
  name: 'request',
  help: 'Use this to request songs!',
  aliases: ['queue'],
  noDM: true,
  usage: 'link',
  timeout: 10,
  level: 1,
  fn: function (msg, suffix, bot) {
    if (!suffix) {
      msg.reply('Please enter something to search for!')
    } else {
      var u = require('url').parse(suffix)
      if (u.host === null) {
        v.request(msg, 'ytsearch:' + suffix, bot)
      } else {
        v.request(msg, suffix, bot)
      }
    }
  }
}

exports.Commands = Commands
