const {resolveTracks, addTracks, hhMMss} = require('../internal/encoder-selector.js')
const url = require('url')
module.exports = {
  meta: {
    level: 1,
    timeout: 0,
    alias: ['play'],
    help: 'succ'
  },
  fn: async (msg, suffix) => {
    // TODO: Change level to 0, add check for is user in same VC as bot.
    if (global.bot.voiceConnections.get(msg.channel.guild.id)) {
      if (!suffix) {
        global.i18n.send('NO_SEARCH_SUFFIX', msg.channel, {author: msg.author.mention})
      } else {
        if (url.parse(suffix).host === null) {
          resolveTracks(`ytsearch:${encodeURI(suffix)}`).then(tracks => {
            if (tracks.length === 0) {
              global.i18n.send('NO_TRACK_FOUND', msg.channel, {author: msg.author.mention})
            } else {
              hhMMss(tracks[0].info.length / 1000).then(time => {
                addTracks(msg, [tracks[0]])
                global.i18n.send('TRACK_ADDED', msg.channel, {
                  title: tracks[0].info.title,
                  duration: time,
                  user: msg.author.username
                })
              })
            }
          }).catch(err => {
            console.error(err)
          })
        } else {
          // TODO: Maybe fix youtube watch?v=ID&list=smth or throw an error, probably throw.
          resolveTracks(suffix).then(tracks => {
            if (tracks.length === 0) {
              global.i18n.send('LINK_NO_TRACK', msg.channel, {url: suffix})
            } else {
              if (tracks.length === 1) {
                hhMMss(tracks[0].info.length / 1000).then(time => {
                  addTracks(msg, [tracks[0]])
                  global.i18n.send('TRACK_ADDED', msg.channel, {
                    title: tracks[0].info.title,
                    duration: time,
                    user: msg.author.username
                  })
                })
              } else {
                addTracks(msg, tracks)
                global.i18n.send('TRACKS_ADDED', msg.channel, {count: tracks.length})
              }
            }
          }).catch(err => {
            console.error(err)
          })
        }
      }
    } else {
      global.i18n.send('VOICE_NOT_CONNECTED', msg.channel)
    }
  }
}
