const { createPlayer, resolveTracks, hhMMss } = require('../selectors/encoder-selector.js')
module.exports = {
  meta: {
    help: 'Make the bot join a voice channel. Optionally supply a track to play on join.',
    usage: '[song link or YouTube search query]',
    module: 'Music',
    level: 1,
    noDM: true,
    alias: ['voice']
  },
  fn: async (msg, suffix) => {
    if (msg.channel.guild.channels.filter(c => c.type === 2).length === 0) {
      global.i18n.send('NO_VOICE_CHANNELS', msg.channel)
    } else if (!msg.member.voiceState.channelID) {
      global.i18n.send('JOIN_VOICE_CHANNEL', msg.channel)
    } else if (!msg.channel.guild.channels.find(c => c.id === msg.member.voiceState.channelID).permissionsOf(global.bot.user.id).has('voiceConnect') || !msg.channel.guild.channels.find(c => c.id === msg.member.voiceState.channelID).permissionsOf(global.bot.user.id).has('voiceSpeak')) {
      global.i18n.send('NO_VOICE_CONNECT_PERM', msg.channel, { channel: msg.channel.guild.channels.find(c => c.id === msg.member.voiceState.channelID).name })
    } else if (global.bot.voiceConnections.get(msg.channel.guild.id)) {
      const channelID = global.bot.voiceConnections.get(msg.channel.guild.id).channelId === undefined ? global.bot.voiceConnections.get(msg.channel.guild.id).channelID : global.bot.voiceConnections.get(msg.channel.guild.id).channelId
      global.i18n.send('VOICE_CONNECTED', msg.channel, { channel: msg.channel.guild.channels.find(c => c.id === channelID).name })
    } else {
      if (suffix) {
        const urlregex = new RegExp(/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_+.~#?&/=]*)/) // eslint-disable-line
        const isURL = (input) => {
          return input.match(urlregex)
        }
        const link = isURL(suffix) ? new URL(suffix) : {}
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
                  createPlayer(msg, result)
                  global.i18n.send('TRACK_ADDED', msg.channel, {
                    title: result[0].info.title,
                    duration: time,
                    user: msg.author.username
                  })
                })
              } else {
                createPlayer(msg, result)
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
                createPlayer(msg, [result[0]])
                global.i18n.send('TRACK_ADDED', msg.channel, {
                  title: result[0].info.title,
                  duration: time,
                  user: msg.author.username
                })
              })
            }
          }).catch(global.logger.error)
        }
      } else {
        createPlayer(msg)
      }
    }
  }
}
