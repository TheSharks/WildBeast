const {createPlayer, resolveTracks, hhMMss} = require('../internal/encoder-selector.js')
const url = require('url')
module.exports = {
  meta: {
    level: 1,
    timeout: 0,
    alias: ['voice'],
    help: 'succ'
  },
  fn: async (msg, suffix) => {
    if (msg.channel.guild.channels.filter(c => c.type === 2).length === 0) {
      global.i18n.send('NO_VOICE_CHANNELS', msg.channel)
    } else if (!msg.member.voiceState.channelID) {
      global.i18n.send('JOIN_VOICE_CHANNEL', msg.channel)
    } else if (global.bot.voiceConnections.get(msg.channel.guild.id)) {
      global.i18n.send('VOICE_CONNECTED', msg.channel, {channel: msg.channel.guild.channels.find(c => c.id === global.bot.voiceConnections.get(msg.channel.guild.id).channelId).name})
    } else {
      if (suffix) {
        if (url.parse(suffix).hostname) {
          resolveTracks(suffix).then(tracks => {
            if (tracks.length === 1) {
              hhMMss(tracks[0].info.length / 1000).then(time => {
                createPlayer(msg, tracks)
                global.i18n.send('TRACK_ADDED', msg.channel, {
                  title: tracks[0].info.title,
                  duration: time,
                  user: msg.author.username
                })
              })
            } else {
              createPlayer(msg, tracks)
              global.i18n.send('TRACKS_ADDED', msg.channel, {count: tracks.length})
            }
          }).catch(console.error)
        } else {
          resolveTracks(encodeURI(`ytsearch:${suffix}`)).then(tracks => {
            if (tracks.length === 0) {
              global.i18n.send('NO_TRACK_FOUND', msg.channel, {author: msg.author.mention})
            } else {
              hhMMss(tracks[0].info.length / 1000).then(time => {
                createPlayer(msg, [tracks[0]])
                global.i18n.send('TRACK_ADDED', msg.channel, {
                  title: tracks[0].info.title,
                  duration: time,
                  user: msg.author.username
                })
              })
            }
          }).catch(console.error)
        }
      } else {
        createPlayer(msg)
      }
    }
  }
}