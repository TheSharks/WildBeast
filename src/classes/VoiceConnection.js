module.exports = class VoiceConnection {
  constructor (opts) {
    this.id = opts.id
    this.playlist = []
    this.controllers = opts.controllers
    this._encoder = opts.encoder
    this.fresh = true
    this.textChannel = opts.textChannel

    this._encoder.on('trackEnd', () => {
      if (this.playlist.length === 0) {
        this.textChannel.createMessage('The queue is empty, disconnecting')
        this.destroy()
      } else this.next()
    })
    this._encoder.on('trackError', x => {
      this.textChannel.createMessage(`The track I'm trying to play broke! \`${x.error}\``)
      this.next()
    })
    this._encoder.on('trackStuck', x => {
      logger.debug(x)
      this.textChannel.createMessage('Seems the track got stuck, automatically skipping it...')
      this.next()
    })
    this._encoder.on('trackStart', ctx => {
      const index = this.playlist.findIndex(x => x.track === ctx.track)
      // the track its playing is not guaranteed in the playlist
      this.nowPlaying = this.playlist[index] || { info: {} }
      if (index !== -1) this.playlist.splice(index, 1)
      this.textChannel.createMessage({
        content: 'Now playing:',
        embed: {
          url: this.nowPlaying.info.uri,
          title: this.nowPlaying.info.title || '[Unknown!]',
          author: {
            name: this.nowPlaying.info.author || '[Unknown!]',
            ...(this.nowPlaying.info.authorImage ? { icon_url: this.nowPlaying.info.authorImage } : {}),
            ...(this.nowPlaying.info.authorURL ? { url: this.nowPlaying.info.authorURL } : {})
          },
          ...(this.nowPlaying.info.image ? { thumbnail: { url: this.nowPlaying.info.image } } : {})
        }
      })
    })
    this._encoder.once('disconnected', x => {
      if (x.byRemote && x.code !== 4014) this.textChannel.createMessage('I got disconnected from the voice channel, ending playback')
      this.destroy()
    })
  }

  next (msg = {}) {
    if (msg.reason === 'REPLACED') return
    // the skip command uses this func too
    // if we dont do this, you end up skipping 2 songs
    // since trackEnd will also fire
    const nextup = this.playlist[0]
    // no shift, on(trackStart) does that
    if (nextup) {
      this._encoder.play(nextup.track)
      return nextup
    }
  }

  shuffle () { // https://stackoverflow.com/a/6274381
    for (let i = this.playlist.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.playlist[i], this.playlist[j]] = [this.playlist[j], this.playlist[i]]
    }
  }

  destroy () {
    return this._encoder.disconnect()
  }

  async resolve (ctx) {
    const SA = require('superagent')
    ctx = ctx.trim()
    try {
      const url = new URL(ctx)
      if (process.env.INVIDIOUS_HOST && /(?:https?:\/\/)?(?:www\.)?youtu(.be|be\.com)/.test(url.hostname)) {
        if (url.hostname === 'youtu.be') return this._invidiousResolve(url.pathname.slice(1))
        if (url.searchParams.has('list')) return this._invidiousPlaylist(url.searchParams.get('list'))
        if (url.searchParams.has('v')) return this._invidiousResolve(url.searchParams.get('v'))
      }
      return this._encoder.node.loadTracks(ctx)
    } catch (_) {
      if (process.env.INVIDIOUS_HOST) {
        const resp = await SA.get(`${process.env.INVIDIOUS_HOST}/api/v1/search?q=${encodeURIComponent(ctx)}`)
        return this._invidiousResolve(resp.body[0].videoId)
      } else return this._encoder.node.loadTracks(`scsearch:${ctx}`)
    }
  }

  add (ctx) {
    this.playlist.push(ctx)
    if (this.fresh) {
      this.fresh = false
      this.next()
    }
    return this.playlist
  }

  addMany (ctx) {
    for (const x of ctx) this.playlist.push(x)
    if (this.fresh) {
      this.fresh = false
      this.next()
    }
    return this.playlist
  }

  addDJs (ctx) {
    return this.controllers.push(ctx)
  }

  async _invidiousResolve (videoId) {
    const authorImg = (data) => {
      if (!data.authorThumbnails[0].url || data.authorThumbnails[0].url.length < 1) return undefined // this can happen sometimes
      else if (!data.authorThumbnails[0].url.startsWith('https:')) return `https:${data.authorThumbnails[0].url}`
      return data.authorThumbnails[0].url
    }
    const itags = ['251', '250', '249', '171', '141', '140', '139']
    const SA = require('superagent')
    const info = await SA.get(`${process.env.INVIDIOUS_HOST}/api/v1/videos/${videoId}?fields=author,title,authorThumbnails,authorUrl,adaptiveFormats`)
    const tag = info.body.adaptiveFormats.find(x => itags.includes(x.itag))
    const lavaresp = await this._encoder.node.loadTracks(`${process.env.INVIDIOUS_HOST}/latest_version?id=${videoId}&itag=${tag.itag}${process.env.INVIDIOUS_PROXY ? '&local=true' : ''}`)
    if (lavaresp.loadType !== 'TRACK_LOADED') return lavaresp
    lavaresp.tracks[0].info = {
      ...lavaresp.tracks[0].info,
      author: info.body.author,
      title: info.body.title,
      uri: `https://youtu.be/${videoId}`,
      image: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      authorImage: authorImg(info.body),
      authorURL: `https://youtube.com${info.body.authorUrl}`
    }
    return lavaresp
  }

  async _invidiousPlaylist (id) {
    const authorImg = (data) => {
      if (!data.authorThumbnails[0].url || data.authorThumbnails[0].url.length < 1) return undefined // this can happen sometimes
      else if (!data.authorThumbnails[0].url.startsWith('https:')) return `https:${data.authorThumbnails[0].url}`
      return data.authorThumbnails[0].url
    }
    const SA = require('superagent')
    const resp = await SA.get(`${process.env.INVIDIOUS_HOST}/api/v1/playlists/${id}`)
    const result = await Promise.allSettled(resp.body.videos.map(x => this._invidiousResolve(x.videoId)))
    this.addMany(result.filter(x => x.status === 'fulfilled').map(x => x.value.tracks).flat(1))
    return {
      loadType: 'IV_PLAYLIST_LOADED',
      uri: `https://youtube.com/playlist?list=${resp.body.playlistId}`,
      title: resp.body.title,
      author: resp.body.author,
      authorImage: authorImg(resp.body),
      authorURL: `https://youtube.com${resp.body.authorUrl}`,
      image: resp.body.playlistThumbnail
    }
  }
}
