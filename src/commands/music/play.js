const Command = require('../../classes/Command')

module.exports = new Command(async function (msg, suffix) {
  const client = require('../../components/client')
  const player = client.voiceConnectionManager.get(msg.channel.guild.id)
  if (player) {
    const m = await this.safeSendMessage(msg.channel, 'Working on it...')
    try {
      const x = await player.resolve(suffix)
      switch (x.loadType) {
        case 'PLAYLIST_LOADED': {
          if (x.tracks && x.tracks.length > 0) {
            player.addMany(x.tracks)
            return m.edit(`Playlist ${x.playlistInfo.name} has been added`)
          } else return m.edit('Nothing found with your search query')
        }
        case 'IV_PLAYLIST_LOADED': {
          return m.edit({
            content: 'Your playlist has finished loading',
            embed: {
              url: x.uri,
              title: x.title,
              author: {
                name: x.author,
                icon_url: x.authorImage,
                url: x.authorURL
              },
              thumbnail: {
                url: x.image
              }
            }
          })
        }
        case 'SEARCH_RESULT':
        case 'TRACK_LOADED': {
          if (x.tracks && x.tracks.length > 0) {
            player.add(x.tracks[0])
            return m.edit('Your track has been added')
          } else return m.edit('Nothing found with your search query')
        }
        case 'LOAD_FAILED': {
          if (x.exception.severity === 'COMMON') return m.edit(`I'm unable to play that track: \`${x.exception.message}\``)
          else return m.edit("I'm unable to play that track for unknown reasons")
        }
        case 'NO_MATCHES': return m.edit('Nothing found with your search query')
        default: return m.edit('Something went wrong while adding this track, try again later')
      }
    } catch (e) {
      logger.error('CMD', e)
      if (!(m instanceof require('eris').Message)) await this.safeSendMessage(msg.channel, 'Something went wrong, try again?')
      else await m.edit('Something went wrong, try again?')
    }
  } else return this.safeSendMessage(msg.channel, "I'm not streaming in this server")
}, {
  aliases: ['request'],
  prereqs: ['musicCommand'],
  disableDM: true
})
