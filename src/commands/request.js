const {resolveTracks, addTracks, hhMMss} = require('../internal/encoder-selector.js')
const url = require('url')
module.exports = {
  meta: {
    help: 'Add a track to the playback queue.',
    usage: '<track link>',
    module: 'Music',
    level: 1,
    noDM: true,
    alias: ['play'],
    addons: [
      `Supported resources: YouTube, SoundCloud, Bandcamp, Twitch, Vimeo, Mixer and raw HTML audio`
    ]
  },
  fn: async (msg, suffix) => {
    if (global.bot.voiceConnections.get(msg.channel.guild.id)) {
      if (!suffix) {
        global.i18n.send('NO_SEARCH_SUFFIX', msg.channel, {user: msg.author.mention})
      } else {
        let link = url.parse(suffix)
        let splitLink
        if (link.hostname) {
          if (suffix.includes('list=') !== suffix.includes('playlist?')) {
            if (suffix.includes('youtu.be')) {
              splitLink = suffix.split('?list=')
              global.i18n.send('YOUTUBE_PLAYLIST_MALFORMED_LINK', msg.channel, {
                video: splitLink[0],
                playlist: splitLink[1]
              })
            } else {
              splitLink = suffix.split('&list=')
              global.i18n.send('YOUTUBE_PLAYLIST_MALFORMED_LINK', msg.channel, {
                video: splitLink[0],
                playlist: splitLink[1]
              })
            }
          } else {
            resolveTracks(suffix).then(tracks => {
              if (tracks.length === 0) {
                global.i18n.send('LINK_NO_TRACK', msg.channel, {user: msg.author.username, url: suffix})
              } else if (tracks.tracks.length === 1) {
                hhMMss(tracks.tracks[0].info.length / 1000).then(time => {
                  addTracks(msg, tracks.tracks)
                  global.i18n.send('TRACK_ADDED', msg.channel, {
                    title: tracks.tracks[0].info.title,
                    duration: time,
                    user: msg.author.username
                  })
                })
              } else {
                addTracks(msg, tracks.tracks)
                global.i18n.send('TRACKS_ADDED', msg.channel, {count: tracks.length, user: msg.author.username})
              }
            }).catch(global.logger.error)
          }
        } else {
          resolveTracks(`ytsearch:${encodeURI(suffix)}`).then(tracks => {
            if (tracks.tracks.length === 0) {
              global.i18n.send('SEARCH_NO_TRACKS', msg.channel, {user: msg.author.mention})
            } else {
              hhMMss(tracks.tracks[0].info.length / 1000).then(time => {
                addTracks(msg, [tracks.tracks[0]])
                global.i18n.send('TRACK_ADDED', msg.channel, {
                  title: tracks.tracks[0].info.title,
                  duration: time,
                  user: msg.author.username
                })
              })
            }
          }).catch(global.logger.error)
        }
      }
    } else {
      global.i18n.send('VOICE_NOT_CONNECTED', msg.channel)
    }
  }
}
