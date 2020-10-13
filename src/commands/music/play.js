const Command = require('../../classes/Command')

module.exports = new Command(async function (msg, suffix) {
  const client = require('../../components/client')
  const player = client.voiceConnectionManager.get(msg.channel.guild.id)
  if (player) {
    if (!(require('../../components/prereqs/musicCommand').fn(msg))) {
      return this.safeSendMessage(msg.channel, require('../../components/prereqs/musicCommand').errorMessage(msg))
    }
    const m = await this.safeSendMessage(msg.channel, i18n.t('commands.common.working'))
    try {
      const x = await player.resolve(suffix)
      switch (x.loadType) {
        case 'PLAYLIST_LOADED': {
          if (x.tracks && x.tracks.length > 0) {
            player.addMany(x.tracks)
            return m.edit(i18n.t('commands.play.playlistAdded', { name: x.playlistInfo.name }))
          } else return m.edit(i18n.t('commands.play.noResults'))
        }
        case 'IV_PLAYLIST_LOADED': {
          return m.edit({
            content: i18n.t('commands.play.ivPlaylist'),
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
            return m.edit(i18n.t('commands.play.trackAdded'))
          } else return m.edit(i18n.t('commands.play.noResults'))
        }
        case 'LOAD_FAILED': {
          if (x.exception.severity === 'COMMON') return m.edit(i18n.t('commands.play.cantPlay', { message: x.exception.message }))
          else return m.edit(i18n.t('commands.play.cantPlayUnknown'))
        }
        case 'NO_MATCHES': return m.edit(i18n.t('commands.play.noResults'))
        default: return m.edit(i18n.t('commands.play.addFailed'))
      }
    } catch (e) {
      logger.error('CMD', e)
      if (!(m instanceof require('eris').Message)) await this.safeSendMessage(msg.channel, i18n.t('commands.common.softFail'))
      else await m.edit(i18n.t('commands.common.softFail'))
    }
  } else return require('./joinvoice').run(msg, suffix)
}, {
  aliases: ['request'],
  disableDM: true
})
