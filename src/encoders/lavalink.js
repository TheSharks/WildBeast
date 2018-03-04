const superagent = require('superagent')
const nodes = process.env['LAVA_NODES'] ? process.env['LAVA_NODES'] : [{
  host: 'localhost',
  port: 9090,
  region: 'us',
  password: 'password'
}]
const guildInfo = {}
module.exports = {
  nodes: nodes,
  guildInfo: guildInfo,
  init: () => {
    const {PlayerManager} = require('eris-lavalink')
    let regions = {
      eu: ['eu', 'amsterdam', 'frankfurt', 'russia', 'hongkong', 'singapore', 'sydney'],
      us: ['us', 'brazil']
    }

    if (!(global.bot.voiceConnections instanceof PlayerManager)) {
      global.bot.voiceConnections = new PlayerManager(global.bot, nodes, {
        numShards: process.env['SHARD_COUNT'] ? process.env['SHARD_COUNT'] : 1,
        userId: global.bot.user.id,
        regions: regions,
        defaultRegion: 'us'
      })
    }
    global.logger.log('LavaLink has been initiated.')
  },
  getPlayer: async (channel) => {
    if (!channel || !channel.guild) {
      throw('Not a guild channel.')
    }

    let player = global.bot.voiceConnections.get(channel.guild.id)
    if (player) {
      return (player)
    }

    let options = {}
    if (channel.guild.region) {
      options.region = channel.guild.region
    }

    return global.bot.joinVoiceChannel(channel.id)
  },
  resolveTracks: async (search) => {
    try {
      var result = await superagent.get(`http://${nodes[0].host}:2333/loadtracks?identifier=${search}`)
        .set('Authorization', nodes[0].password)
        .set('Accept', 'application/json')
    } catch (err) {
      throw(err)
    }

    if (!result) {
      throw('Unable play that video.')
    }

    return (result.body)
  },
  addTracks: async (msg, tracks) => {
    if (guildInfo[msg.channel.guild.id].tracks.length <= 0) {
      let player = await global.bot.voiceConnections.get(msg.channel.guild.id)
      player.play(tracks[0].track)
    }
    for (let track of tracks) {
      track.requester = msg.author.id
      guildInfo[msg.channel.guild.id].tracks.push(track)
    }
  },
  hhMMss: async (time) => {
    if (time || isNaN(time)) {
      let hours = (Math.floor(time / ((60 * 60)) % 24))
      let minutes = (Math.floor(time / (60)) % 60)
      let seconds = (Math.floor(time) % 60)
      let parsedTime = []
      hours >= 1 ? parsedTime.push(hours) : null
      minutes >= 10 ? parsedTime.push(minutes) : parsedTime.push(`0${minutes}`)
      seconds >= 10 ? parsedTime.push(seconds) : parsedTime.push(`0${seconds}`)
      return parsedTime.join(':')
    } else {
      throw '00:00:00'
    }
  },
  createPlayer: async (msg, tracks) => {
    module.exports.getPlayer(msg.channel.guild.channels.find(c => c.id === msg.member.voiceState.channelID)).then(player => {
      guildInfo[msg.channel.guild.id] = {
        tracks: [],
        volume: 100,
        playing: undefined,
        skips: [],
        textChan: msg.channel.id
      }
      if (tracks) {
        module.exports.addTracks(msg, tracks)
      }
      player.on('error', err => global.logger.error(err))
      player.on('stuck', msg => global.logger.error(msg))
      player.on('disconnect', wat => global.logger.error(wat))
      player.on('end', async data => {
        if (data.reason && data.reason !== "REPLACED") {
          if (guildInfo[data.guildId].tracks.length > 1) {
            global.i18n.send('NEXT_TRACK', global.bot.guilds.get(data.guildId).channels.find(c => c.id === guildInfo[data.guildId].textChan), {current: guildInfo[data.guildId].tracks[0].info.title, next: guildInfo[data.guildId].tracks[1].info.title, duration: await module.exports.hhMMss(guildInfo[data.guildId].tracks[1].info.length / 1000), user: global.bot.users.get(guildInfo[data.guildId].tracks[1].requester).username})
            guildInfo[data.guildId].tracks.shift()
            guildInfo[data.guildId].skips = []
            module.exports.getPlayer(global.bot.guilds.get(data.guildId).channels.find(c => c.id === global.bot.voiceConnections.get(data.guildId).channelId)).then(player => {
              player.play(guildInfo[data.guildId].tracks[0].track)
            })
          } else {
            //TODO: check if stay is set because selfhost otherwise leave and delete the guild info object and destroy the player
            guildInfo[data.guildId].tracks.shift()
            global.bot.createMessage(guildInfo[data.guildId].textChan, 'Playlist has ended.')
          }
        }

      })
    })
  }
}