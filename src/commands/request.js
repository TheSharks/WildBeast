const { resolveTracks, addTracks, hhMMss } = require('../selectors/encoder-selector.js')
module.exports = {
  meta: {
    help: 'Add a track to the playback queue.',
    usage: '<song link or YouTube search query>',
    module: 'Music',
    level: 1,
    noDM: true,
    alias: ['play'],
    addons: [
      'Supported resources: YouTube, SoundCloud, Bandcamp, Twitch, Vimeo, Mixer and raw HTML audio'
    ]
  },
  fn: async (msg, suffix) => {
    if (global.bot.voiceConnections.get(msg.channel.guild.id)) {
      if (!suffix) {
        global.i18n.send('NO_SEARCH_SUFFIX', msg.channel, { user: msg.author.mention })
      } else {
        const urlregex = new RegExp(/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_+.~#?&/=]*)/)
        const isURL = (input) => {
          return input.match(urlregex)
        }
        const link = isURL(suffix) ? new URL(suffix) : {} // HACK
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
            resolveTracks(suffix).then(result => {
              global.logger.trace(result)
              if (result.length === 0) {
                global.i18n.send('LINK_NO_TRACK', msg.channel, { user: msg.author.username, url: suffix })
              } else if (result.length === 1) {
                hhMMss(result[0].info.length / 1000).then(time => {
                  addTracks(msg, result)
                  global.i18n.send('TRACK_ADDED', msg.channel, {
                    title: result[0].info.title,
                    duration: time,
                    user: msg.author.username
                  })
                })
              } else {
                addTracks(msg, result)
                global.i18n.send('TRACKS_ADDED', msg.channel, { count: result.length, user: msg.author.username })
              }
            }).catch(global.logger.error)
          }
        } else {
          resolveTracks(`ytsearch:${encodeURI(suffix)}`).then(result => {
            global.logger.trace(result)
            if (result.length === 0) {
              global.i18n.send('SEARCH_NO_TRACKS', msg.channel, { user: msg.author.mention })
            } else {
              hhMMss(result[0].info.length / 1000).then(time => {
                addTracks(msg, [result[0]])
                global.i18n.send('TRACK_ADDED', msg.channel, {
                  title: result[0].info.title,
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
