var list = {}
var status = {}
var requestLink = {}
var splitLink = {}
var temp
var YT = require('youtube-dl')
var fs = require('fs')
var Logger = require('./logger.js').Logger
var Config = require('../../config.json')
var bugsnag = require('bugsnag')
var stream = require('stream')
var superagent = require('superagent')
var regex = /([~*_])/g
bugsnag.register(Config.api_keys.bugsnag)

exports.registerVanity = function (msg) {
  list[msg.guild.id] = {
    vanity: true
  }
}

exports.unregisterVanity = function (msg) {
  list[msg.guild.id] = {
    vanity: false
  }
}

exports.join = function (msg, suffix, bot) {
  if (bot.VoiceConnections.length > Config.settings.maxvcslots) {
    msg.channel.sendMessage('Sorry pal, all the voice connections are currently being used! Please wait until one is set free.')
  } else if (msg.guild.voiceChannels.length === 0) {
    msg.channel.sendMessage(`Sorry pal, but you do not have any voice channels I can join.`)
  } else {
    list[msg.guild.id] = {
      vanity: false
    }
    var voiceCheck = bot.VoiceConnections.find((r) => r.voiceConnection.guild.id === msg.guild.id)
    if (!voiceCheck && !suffix) {
      var VC = msg.member.getVoiceChannel()
      if (VC) {
        VC.join().then((vc) => {
          var prefix = Config.settings.prefix
          require('../datacontrol.js').customize.prefix(msg).then((r) => {
            if (r !== null) prefix = r
            prefix = prefix.replace(regex, '\\$1')
            var joinmsg = []
            joinmsg.push(`I've joined voice channel **${vc.voiceConnection.channel.name}** which you're currently connected to.`)
            joinmsg.push(`You have until the end of the wait music to request something.`)
            joinmsg.push(`__**Voice Commands**__`)
            joinmsg.push(`**${prefix}request** - *Request a song via a youtube or soundcloud link, or any kind of compatible music file.*`)
            joinmsg.push(`**${prefix}music pause** - *Pauses the current song.*`)
            joinmsg.push(`**${prefix}music play** - *Resumes the current song.*`)
            joinmsg.push(`**${prefix}volume** - *Change the volume of the current song.*`)
            joinmsg.push(`**${prefix}playlist** - *List upcoming requested songs.*`)
            joinmsg.push(`**${prefix}shuffle** - *Shuffle the music playlist.*`)
            joinmsg.push(`**${prefix}voteskip** - *Vote to skip the current song.*`)
            joinmsg.push(`**${prefix}skip** - *Force skip the current song.*`)
            joinmsg.push(`**${prefix}leave-voice** - *Leaves the voice channel.*`)
            msg.channel.sendMessage(joinmsg.join('\n'))
            status[msg.guild.id] = true
            waiting(vc, msg, bot)
          })
        }).catch((err) => {
          if (err.message === 'Missing permission') {
            msg.reply('I could not join the channel you\'re in because I don\'t have `Connect` permissions :cry:')
          }
        })
      } else if (!VC) {
        msg.guild.voiceChannels[0].join().then((vc) => {
          var prefix = Config.settings.prefix
          require('../datacontrol.js').customize.prefix(msg).then((r) => {
            if (r !== null) prefix = r
            prefix = prefix.replace(regex, '\\$1')
            var joinmsg = []
            joinmsg.push(`I've joined voice channel **${vc.voiceConnection.channel.name}** because you didn't specify a voice channel for me to join.`)
            joinmsg.push(`You have until the end of the wait music to request something.`)
            joinmsg.push(`__**Voice Commands**__`)
            joinmsg.push(`**${prefix}request** - *Request a song via a youtube or soundcloud link,  or any kind of compatible music file.*`)
            joinmsg.push(`**${prefix}music pause** - *Pauses the current song.*`)
            joinmsg.push(`**${prefix}music play** - *Resumes the current song.*`)
            joinmsg.push(`**${prefix}volume** - *Change the volume of the current song.*`)
            joinmsg.push(`**${prefix}playlist** - *List upcoming requested songs.*`)
            joinmsg.push(`**${prefix}shuffle** - *Shuffle the music playlist.*`)
            joinmsg.push(`**${prefix}voteskip** - *Vote to skip the current song.*`)
            joinmsg.push(`**${prefix}skip** - *Force skip the current song.*`)
            joinmsg.push(`**${prefix}leave-voice** - *Leaves the voice channel.*`)
            msg.channel.sendMessage(joinmsg.join('\n'))
            status[msg.guild.id] = true
            waiting(vc, msg, bot)
          })
        }).catch((err) => {
          if (err.message === 'Missing permission') {
            msg.reply('I could not the first voice channel in my list because I don\'t have `Connect` permissions :cry:')
          }
        })
      }
    } else if (!voiceCheck) {
      var channel = msg.channel.guild.voiceChannels.find((a) => {
        return a.name.toLowerCase().indexOf(suffix.toLowerCase()) >= 0
      })
      if (channel === undefined) {
        msg.reply('That is not a valid voice channel.')
      } else {
        channel.join().then((vc) => {
          var prefix = Config.settings.prefix
          require('../datacontrol.js').customize.prefix(msg).then((r) => {
            if (r !== null) prefix = r
            prefix = prefix.replace(regex, '\\$1')
            var joinmsg = []
            joinmsg.push(`I've joined voice channel **${vc.voiceConnection.channel.name}**.`)
            joinmsg.push(`You have until the end of the wait music to request something.`)
            joinmsg.push(`__**Voice Commands**__`)
            joinmsg.push(`**${prefix}request** - *Request a song via a youtube or soundcloud link, or any kind of compatible music file.*`)
            joinmsg.push(`**${prefix}music pause** - *Pauses the current song.*`)
            joinmsg.push(`**${prefix}music play** - *Resumes the current song.*`)
            joinmsg.push(`**${prefix}volume** - *Change the volume of the current song.*`)
            joinmsg.push(`**${prefix}playlist** - *List upcoming requested songs.*`)
            joinmsg.push(`**${prefix}shuffle** - *Shuffle the music playlist.*`)
            joinmsg.push(`**${prefix}voteskip** - *Vote to skip the current song.*`)
            joinmsg.push(`**${prefix}skip** - *Force skip the current song.*`)
            joinmsg.push(`**${prefix}leave-voice** - *Leaves the voice channel.*`)
            msg.channel.sendMessage(joinmsg.join('\n'))
            status[msg.guild.id] = true
            waiting(vc, msg, bot)
          })
        }).catch((err) => {
          if (err.message === 'Missing permission') {
            msg.reply('Could not join channel as I do not have `Connect` permissions.')
          }
        })
      }
    } else {
      msg.reply('I am already streaming on this server in channel **' + voiceCheck.voiceConnection.channel.name + '**').then((m) => {
        if (Config.settings.autodeletemsg) {
          setTimeout(() => {
            m.delete().catch((e) => Logger.error(e))
          }, Config.settings.deleteTimeout)
        }
      })
    }
  }
}

function leave (bot, msg) {
  if (status[msg.guild.id] === true) {
    msg.channel.sendMessage('Nothing has been added to the playlist during the wait time. Leaving voice channel.')
    var voice = bot.VoiceConnections.find((r) => r.voiceConnection.guild.id === msg.guild.id)
    if (voice) {
      voice.voiceConnection.getEncoder().kill()
      voice.voiceConnection.disconnect()
      delete list[msg.guild.id]
    }
  }
}

exports.leave = function (msg, suffix, bot) {
  status[msg.guild.id] = false
  var voice = bot.VoiceConnections.find((r) => r.voiceConnection.guild.id === msg.guild.id)
  if (voice) {
    voice.voiceConnection.getEncoder().kill()
    voice.voiceConnection.disconnect()
    delete list[msg.guild.id]
  }
}

function waiting (vc, msg, bot) {
  require('../datacontrol.js').customize.volume(msg).then((v) => {
    var music = fs.readdirSync('music/')
    var randMusic = 'music/' + music[Math.floor(Math.random() * music.length)]
    var waitMusic = vc.voiceConnection.createExternalEncoder({
      type: 'ffmpeg',
      source: randMusic,
      format: 'pcm'
    })
    waitMusic.play()
    bot.VoiceConnections.find(v => v.voiceConnection.guild.id === msg.guild.id).voiceConnection.getEncoder().setVolume(v)
    waitMusic.once('end', () => {
      if (status[vc.voiceConnection.guildId] === true) {
        leave(bot, msg)
      }
    })
  })
}

function next (msg, suffix, bot) {
  status[msg.guild.id] = false
  let buffer = new stream.Readable()
  list[msg.guild.id].buffer = buffer
  bot.VoiceConnections
    .map((connection) => {
      if (connection.voiceConnection.guild.id === msg.guild.id) {
        if (list[msg.guild.id].link.length === 0) {
          if (Config.settings.leaveAfterEndOfPlaylist) {
            delete list[msg.guild.id]
            msg.channel.sendMessage('Playlist has ended, leaving voice.').then((m) => {
              if (Config.settings.autodeletemsg) {
                setTimeout(() => {
                  m.delete().catch((e) => Logger.error(e))
                }, Config.settings.deleteTimeout)
              }
            })
            connection.voiceConnection.disconnect()
            return
          } else {
            var prefix = Config.settings.prefix
            require('../datacontrol.js').customize.prefix(msg).then((r) => {
              if (r !== null) prefix = r
              prefix = prefix.replace(regex, '\\$1')
              msg.channel.sendMessage('Playlist has ended! Use `' + prefix + 'request` to add more songs!')
            })
          }
        } else {
          if (list[msg.guild.id].link[0] === 'INVALID') {
            list[msg.guild.id].link.shift()
            list[msg.guild.id].info.shift()
            list[msg.guild.id].requester.shift()
            list[msg.guild.id].skips.count = 0
            list[msg.guild.id].skips.users = []
          }
          var encoder = connection.voiceConnection.createExternalEncoder({
            type: 'ffmpeg',
            format: 'pcm',
            source: '-'
          })
          superagent.get(list[msg.guild.id].link[0])
            .end((err, res) => {
              if (err) {
                Logger.error(err)
                next(msg, suffix, bot)
              } else {
                res.on('data', chunk => {
                  buffer.push(chunk)
                })
                res.on('end', () => {
                  buffer.push(null)
                })
              }
            })
          setTimeout(function () {
            buffer.pipe(encoder.stdin)
            encoder.play()
            if (list[msg.guild.id] && list[msg.guild.id].volume !== undefined) {
              connection.voiceConnection.getEncoder().setVolume(list[msg.guild.id].volume)
            } else {
              require('../datacontrol.js').customize.volume(msg).then((v) => {
                connection.voiceConnection.getEncoder().setVolume(v)
              })
            }
          }, 2500)
          encoder.stdin.on('error', () => {
            // Set the buffer to null to hopefully avoid uhh stuff
            if (list[msg.guild.id]) {
              list[msg.guild.id].buffer = null
            }
          })
          encoder.once('end', () => {
            list[msg.guild.id].buffer = null
            if (list[msg.guild.id].info.length === 0) return
            msg.channel.sendMessage('**' + list[msg.guild.id].info[0] + '** has ended!').then((m) => {
              if (Config.settings.autodeletemsg) {
                setTimeout(() => {
                  m.delete().catch((e) => Logger.error(e))
                }, Config.settings.deleteTimeout)
              }
            })
            list[msg.guild.id].link.shift()
            list[msg.guild.id].info.shift()
            list[msg.guild.id].requester.shift()
            list[msg.guild.id].skips.count = 0
            list[msg.guild.id].skips.users = []
            if (list[msg.guild.id].link.length > 0) {
              msg.channel.sendMessage('Next up is **' + list[msg.guild.id].info[0] + '** requested by _' + list[msg.guild.id].requester[0] + '_').then((m) => {
                if (Config.settings.autodeletemsg) {
                  setTimeout(() => {
                    m.delete().catch((e) => Logger.error(e))
                  }, Config.settings.deleteTimeoutLong)
                }
              })
              next(msg, suffix, bot)
            } else {
              if (Config.settings.leaveAfterEndOfPlaylist) {
                msg.channel.sendMessage('Playlist has ended, leaving voice.').then((m) => {
                  if (Config.settings.autodeletemsg) {
                    setTimeout(() => {
                      m.delete().catch((e) => Logger.error(e))
                    }, Config.settings.deleteTimeout)
                  }
                })
                connection.voiceConnection.disconnect()
              } else {
                var prefix = Config.settings.prefix
                require('../datacontrol.js').customize.prefix(msg).then((r) => {
                  if (r !== null) prefix = r
                  prefix = prefix.replace(regex, '\\$1')
                  msg.channel.sendMessage('Playlist has ended! Use `' + prefix + 'request` to add more songs!')
                })
              }
            }
          })
        }
      }
    })
  buffer.on('error', () => {
    // To the abyss with your error.
  })
}

exports.shuffle = function (msg, bot) {
  var connect = bot.VoiceConnections
    .filter(function (connection) {
      return connection.voiceConnection.guild.id === msg.guild.id
    })
  if (connect.length < 1) {
    msg.reply('I am not currently in any voice channel.')
  } else if (list[msg.guild.id].link === undefined) {
    msg.reply('There\'s nothing in the playlist for me to shuffle!')
  } else if (list[msg.guild.id].link !== undefined && list[msg.guild.id].link.length <= 4) {
    msg.reply('Add more songs to the playlist before using this command again.')
  } else {
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
    }
    msg.reply('Playlist has been shuffled')
  }
}

exports.voteSkip = function (msg, bot) {
  var connect = bot.VoiceConnections
    .filter(function (connection) {
      return connection.voiceConnection.guild.id === msg.guild.id
    })
  if (connect.length < 1) {
    msg.reply('No connection.')
  } else if (list[msg.guild.id].link === undefined) {
    msg.reply('Try requesting a song first before voting to skip.')
  } else if (!msg.member.getVoiceChannel() || (msg.member.getVoiceChannel().id !== connect[0].voiceConnection.channel.id)) {
    msg.reply('You\'re not allowed to vote because you\'re not in the voice channel.')
  } else {
    var count = Math.round((connect[0].voiceConnection.channel.members.length - 2) / 2)
    if (list[msg.guild.id].skips.users.indexOf(msg.author.id) > -1) {
      msg.reply('You already voted to skip this song!')
    } else {
      list[msg.guild.id].skips.users.push(msg.author.id)
      list[msg.guild.id].skips.count++
      if (list[msg.guild.id].skips.count >= count) {
        msg.channel.sendMessage('Voteskip passed, next song coming up!')
        exports.skip(msg, null, bot)
      } else {
        msg.reply(`Voteskip registered, ${count - list[msg.guild.id].skips.count} more votes needed for the vote to pass.`)
      }
    }
  }
}

exports.volume = function (msg, suffix, bot) {
  return new Promise((resolve, reject) => {
    var connect = bot.VoiceConnections.find(v => v.voiceConnection.guild.id === msg.guild.id)
    if (connect) {
      if (suffix.length === 0) {
        if (list[msg.guild.id].volume === undefined) {
          require('../datacontrol.js').customize.volume(msg).then((v) => {
            resolve(`The volume has been customized to be **${v}** by default.`)
          })
        } else {
          resolve(`The volume is currently set to ${list[msg.guild.id].volume}.`)
        }
      } else if (!isNaN(suffix) && suffix <= 100 && suffix > 0) {
        list[msg.guild.id].volume = suffix
        connect.voiceConnection.getEncoder().setVolume(suffix)
        resolve(`The volume has been set to ${suffix}.`)
      } else {
        reject('Select a number between 0 and 100.')
      }
    }
  })
}

exports.skip = function (msg, suffix, bot) {
  var connect = bot.VoiceConnections
    .filter(function (connection) {
      return connection.voiceConnection.guild.id === msg.guild.id
    })
  if (connect.length < 1) {
    msg.reply('No connection.')
    return
  } else if (list[msg.guild.id].link === undefined) {
    msg.reply('Try requesting a song first before skipping.')
    return
  }
  list[msg.guild.id].link.shift()
  list[msg.guild.id].info.shift()
  list[msg.guild.id].requester.shift()
  list[msg.guild.id].skips.count = 0
  list[msg.guild.id].skips.users = []
  list[msg.guild.id].buffer = null
  next(msg, suffix, bot)
}

exports.music = function (msg, suffix, bot) {
  bot.VoiceConnections
    .map((connection) => {
      if (connection.voiceConnection.guild.id === msg.guild.id) {
        if (suffix.toLowerCase() === 'pause') {
          connection.voiceConnection.getEncoderStream().cork()
        } else if (suffix.toLowerCase() === 'play') {
          connection.voiceConnection.getEncoderStream().uncork()
        } else {
          msg.channel.sendMessage('Use either pause or play after the command.')
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

exports.deleteFromPlaylist = function (msg, what) {
  return new Promise(function (resolve, reject) {
    if (list[msg.guild.id].info === undefined) {
      reject('The playlist is currently empty, try adding some songs!')
    } else if (what === 'all') {
      try {
        list[msg.guild.id].info.splice(1)
        list[msg.guild.id].link.splice(1)
        list[msg.guild.id].requester.splice(1)
        list[msg.guild.id].skips.count = 0
        list[msg.guild.id].skips.users = []
        resolve('Playlist has been cleared.')
      } catch (e) {
        reject(e)
      }
    } else if (what > 0 && list[msg.guild.id].info[what] !== undefined) {
      resolve(list[msg.guild.id].info[what])
      list[msg.guild.id].info.splice(what, 1)
      list[msg.guild.id].requester.splice(what, 1)
      list[msg.guild.id].link.splice(what, 1)
    } else {
      reject('That is not a valid song number.')
    }
  })
}

exports.request = function (msg, suffix, bot) {
  var connect = bot.VoiceConnections
    .filter(function (connection) {
      return connection.voiceConnection.guild.id === msg.guild.id
    })
  if (connect.length < 1) {
    msg.channel.sendMessage('I\'m not connected to any voice channel in this server, try initializing me with the command `voice` first!')
  } else if (list[msg.guild.id].vanity) {
    msg.reply(`You've used a special command to get the bot into a voice channel, you cannot use regular voice commands while this is active.`)
  } else {
    var link = require('url').parse(suffix)
    var query = require('querystring').parse(link.query)
    msg.channel.sendTyping()
    if (suffix.includes('list=') !== suffix.includes('playlist?')) {
      requestLink[msg.guild.id] = suffix
      if (suffix.includes('youtu.be')) { // If the link is shortened with youtu.be
        splitLink[msg.guild.id] = requestLink[msg.guild.id].split('?list=') // Check for this instead of &list
        msg.channel.sendMessage(`Try that again with either a link to the video or the playlist.
**Video:** <${splitLink[msg.guild.id][0]}>
**Playlist:** <https://www.youtube.com/playlist?list=${splitLink[msg.guild.id][1]}>`)
      } else {
        splitLink[msg.guild.id] = requestLink[msg.guild.id].split('&list=')
        msg.channel.sendMessage(`Try that again with either a link to the video or the playlist.
**Video:** <${splitLink[msg.guild.id][0]}>
**Playlist:** <https://www.youtube.com/playlist?list=${splitLink[msg.guild.id][1]}>`)
      }
    } else if (query.list && query.list.length > 8 && link.host.indexOf('youtu') > -1) {
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
          msg.channel.sendMessage('Something went wrong while requesting information about this playlist.').then((m) => {
            if (Config.settings.autodeletemsg) {
              setTimeout(() => {
                m.delete().catch((e) => Logger.error(e))
              }, Config.settings.deleteTimeout)
            }
          })
          Logger.error('Playlist failure, ' + err)
          return
        } else if (data) {
          temp = data.items
          safeLoop(msg, suffix, bot)
        }
      })
    } else {
      fetch(suffix, msg).then((r) => {
        msg.channel.sendMessage(`Added **${r.title}** to the playlist.`).then((m) => {
          if (Config.settings.autodeletemsg) {
            setTimeout(() => {
              m.delete().catch((e) => Logger.error(e))
            }, Config.settings.deleteTimeout)
          }
        })
        if (r.autoplay === true) {
          next(msg, suffix, bot)
        }
      }).catch((e) => {
        Logger.error(e)
        var error = (e.error.split('ERROR:')[1].length !== 2) ? e.error.split('ERROR:')[1] : e.error.split('WARNING:')[1]
        msg.channel.sendMessage('I couldn\'t add that to the playlist, error returned:' + error.replace(Config.api_keys.google, '👀').split('Traceback')[0].split('please report')[0]).then((m) => {
          if (Config.settings.autodeletemsg) {
            setTimeout(() => {
              m.delete().catch((e) => Logger.error(e))
            }, Config.settings.deleteTimeout)
          }
        })
      })
    }
  }
}

exports.leaveRequired = function (bot, guild) {
  var connect = bot.VoiceConnections
    .find(function (connection) {
      connection.voiceConnection.guild.id === guild
    })
  if (connect) {
    if (connect.voiceConnection.channel.members.length <= 1) {
      delete list[guild.id]
      connect.voiceConnection.disconnect()
    }
  }
}

function fetch (v, msg, stats) {
  return new Promise(function (resolve, reject) {
    var x = 0
    var y = 1
    if (stats) {
      x = stats
    }
    var options
    if (v.indexOf('youtu') > -1) {
      options = ['--skip-download', '-f bestaudio/worstvideo', '--add-header', 'Authorization:' + Config.api_keys.google]
    } else {
      options = ['--skip-download', '-f bestaudio/worstvideo']
    }
    YT.getInfo(v, options, {maxBuffer: Infinity}, function (err, i) {
      if (!err && i) {
        y++
        if (list[msg.guild.id] === undefined) {
          return reject({
            error: 'Bot no longer in voice',
            done: true
          })
        } else if (list[msg.guild.id].link === undefined || list[msg.guild.id].link.length < 1) {
          list[msg.guild.id] = {
            link: [i.url],
            vanity: false,
            info: [i.title],
            volume: undefined,
            requester: [msg.author.username],
            skips: {
              count: 0,
              users: []
            }
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
      } else if (err) {
        bugsnag.notify(err.message)
        y++
        if (y > x) {
          return reject({
            error: err.message,
            done: true
          })
        } else {
          return reject({
            error: err.message
          })
        }
      }
    })
  })
}

function safeLoop (msg, suffix, bot) {
  if (temp.length === 0) {
    msg.channel.sendMessage('Done fetching that playlist')
  } else {
    YTFetch(temp[0], msg, suffix, bot).then((f) => {
      if (f) {
        msg.channel.sendMessage(`Autoplaying ${list[msg.guild.id].info[0]}`)
        next(msg, suffix, bot)
      }
      temp.shift()
      safeLoop(msg, suffix, bot)
    }, () => {
      temp.shift()
      safeLoop(msg, suffix, bot)
    })
  }
}

function YTFetch (video, msg) {
  return new Promise(function (resolve, reject) {
    var first = false
    YT.getInfo('https://youtube.com/watch?v=' + video.snippet.resourceId.videoId, ['--skip-download', '-f bestaudio/worstvideo', '--add-header', 'Authorization:' + Config.api_keys.google], {maxBuffer: Infinity}, (err, i) => {
      if (!err && i) {
        if (list[msg.guild.id] === undefined) {
          temp = null
          return reject(first)
        } else if (list[msg.guild.id].link === undefined || list[msg.guild.id].link.length < 1) {
          list[msg.guild.id] = {
            vanity: false,
            link: [],
            info: [],
            volume: undefined,
            requester: [],
            skips: {
              count: 0,
              users: []
            }
          }
          first = true
        }
        list[msg.guild.id].link.push(i.url)
        list[msg.guild.id].info.push(i.title)
        list[msg.guild.id].requester.push(msg.author.username)
        return resolve(first)
      } else {
        bugsnag.notify(err)
        Logger.debug('Playlist debug, ' + err)
        return reject(first)
      }
    })
  })
}
