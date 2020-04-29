const youtubedl = require('youtube-dl')
const util = require('util')
const guildInfo = {}

module.exports = {
  guildInfo: guildInfo,
  init: () => {
    global.logger.debug('Using FFmpeg encoder.')
  },
  getPlayer: async (channel) => {
    if (!channel || !channel.guild) {
      throw new Error('Not a guild channel.')
    }

    const player = global.bot.voiceConnections.get(channel.guild.id)
    if (player) {
      return (player)
    }

    return global.bot.joinVoiceChannel(channel.id)
  },
  resolveTracks: async (search) => {
    const getInfo = util.promisify(youtubedl.getInfo)
    let info = await getInfo(search.replace('%20', ' '), ['--skip-download', '-f', '[acodec*=opus]/bestaudio/best'])
    if (!Array.isArray(info)) info = [info]
    const tracks = []
    for (const t of info) {
      tracks.push({
        track: t.url,
        info: {
          identifier: t.id,
          author: t.uploader,
          length: t._duration_raw * 1000,
          title: t.title,
          uri: t.webpage_url
        }
      })
    }
    return tracks
  },
  addTracks: async (msg, tracks) => {
    if (guildInfo[msg.channel.guild.id].tracks.length <= 0) {
      module.exports.getPlayer(msg.channel).then(p => {
        p.play(tracks[0].track, { inlineVolume: true })
      })
    }
    for (const track of tracks) {
      track.requester = msg.author.id
      guildInfo[msg.channel.guild.id].tracks.push(track)
    }
  },
  skip: async (msg) => {
    guildInfo[msg.channel.guild.id].tracks.shift()
    guildInfo[msg.channel.guild.id].skips = []
    module.exports.getPlayer(msg.channel).then(p => p.stopPlaying())
    if (guildInfo[msg.channel.guild.id].paused === true) guildInfo[msg.channel.guild.id].paused = false
  },
  stop: async (msg) => {
    if (!process.env.WILDBEAST_VOICE_PERSIST) {
      const channelID = global.bot.voiceConnections.get(msg.channel.guild.id).channelId === undefined ? global.bot.voiceConnections.get(msg.channel.guild.id).channelID : global.bot.voiceConnections.get(msg.channel.guild.id).channelId
      global.bot.leaveVoiceChannel(channelID)
      guildInfo[msg.channel.guild.id] = undefined
    } else {
      guildInfo[msg.channel.guild.id].tracks.shift()
      guildInfo[msg.channel.guild.id].skips = []
      module.exports.getPlayer(msg.channel).then(p => p.stopPlaying())
    }
  },
  pause: async (guild) => {
    module.exports.getPlayer(guild).then(p => {
      p.pause()
    })
  },
  resume: async (guild) => {
    module.exports.getPlayer(guild).then(p => {
      p.resume()
    })
  },
  setVolume: async (guild, volume) => {
    module.exports.getPlayer(guild).then(p => {
      p.setVolume(volume / 100)
    })
  },
  getTimestamp: async (guild) => {
    return module.exports.getPlayer(guild).then(p => p.current.playTime)
  },
  hhMMss: async (time) => {
    if (time || !isNaN(time)) {
      const hours = (Math.floor(time / ((60 * 60)) % 24))
      const minutes = (Math.floor(time / (60)) % 60)
      const seconds = (Math.floor(time) % 60)
      const parsedTime = []
      if (hours >= 1) parsedTime.push(hours)
      minutes >= 10 ? parsedTime.push(minutes) : parsedTime.push(`0${minutes}`)
      seconds >= 10 ? parsedTime.push(seconds) : parsedTime.push(`0${seconds}`)
      return parsedTime.join(':')
    } else {
      return ('00:00:00')
    }
  },
  leaveVoiceChannel: async (msg) => {
    const channelID = global.bot.voiceConnections.get(msg.channel.guild.id).channelID
    guildInfo[msg.channel.guild.id].leave = true
    global.i18n.send('VOICE_DISCONNECT', msg.channel, { channel: msg.channel.guild.channels.find(c => c.id === channelID).name })
    global.bot.leaveVoiceChannel(channelID)
    guildInfo[msg.channel.guild.id] = undefined
  },
  createPlayer: async (msg, tracks) => {
    const player = await msg.channel.guild.channels.find(c => c.id === msg.member.voiceState.channelID).join()
    guildInfo[msg.channel.guild.id] = {
      tracks: [],
      volume: 100,
      skips: [],
      paused: false,
      endedEarly: false,
      textChan: msg.channel.id
    }
    if (tracks) {
      module.exports.addTracks(msg, tracks)
    }
    player.on('error', err => global.logger.error(err))
    player.on('disconnect', wat => {
      if (wat !== undefined) global.logger.error(`voice disconnect: ${wat}`)
    })
    player.on('end', async () => {
      if (guildInfo[player.id].leave) return
      if (guildInfo[player.id].endedEarly && guildInfo[player.id].tracks.length >= 1) {
        guildInfo[player.id].endedEarly = false
        player.play(guildInfo[player.id].tracks[0].track)
      } else if (guildInfo[player.id].tracks.length > 1) {
        const trackRequester = global.bot.users.get(guildInfo[player.id].tracks[1].requester)
        global.i18n.send('NEXT_TRACK', global.bot.guilds.get(player.id).channels.find(c => c.id === guildInfo[player.id].textChan), {
          current: guildInfo[player.id].tracks[0].info.title,
          next: guildInfo[player.id].tracks[1].info.title,
          duration: await module.exports.hhMMss(guildInfo[player.id].tracks[1].info.length),
          user: trackRequester ? trackRequester.username : 'Unknown user' // In case user is not in guild
        })
        guildInfo[player.id].tracks.shift()
        guildInfo[player.id].skips = []
        player.play(guildInfo[player.id].tracks[0].track, { inlineVolume: true })
      } else {
        if (!process.env.WILDBEAST_VOICE_PERSIST) {
          global.i18n.send('QUEUE_END', global.bot.guilds.get(player.id).channels.find(c => c.id === guildInfo[player.id].textChan))
          global.bot.leaveVoiceChannel(player.channelID)
          guildInfo[player.id] = undefined
        } else {
          guildInfo[player.id].tracks.shift()
          global.i18n.send('VOICE_PERSIST', global.bot.guilds.get(player.id).channels.find(c => c.id === guildInfo[player.id].textChan))
        }
      }
    })
  }
}
