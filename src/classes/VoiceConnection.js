module.exports = class VoiceConnection {
  constructor (opts) {
    this.id = opts.id
    this.playlist = []
    this.controllers = opts.controllers
    this._encoder = opts.encoder
    this.fresh = true
    this.textChannel = opts.textChannel

    this._encoder.on('trackEnd', x => {
      if (x.reason === 'STOPPED') return
      if (this.playlist.length === 0) {
        this.textChannel.createMessage(i18n.t('voice.events.queueEmpty'))
        this.destroy()
      } else this.next(x)
    })
    this._encoder.on('trackError', x => {
      this.textChannel.createMessage(i18n.t('voice.events.trackBroke', { error: x.error }))
      this.next()
    })
    this._encoder.on('trackStuck', x => {
      logger.debug(x)
      this.textChannel.createMessage(i18n.t('voice.events.trackStuck'))
      this.next()
    })
    this._encoder.on('trackStart', ctx => {
      const index = this.playlist.findIndex(x => x.track === ctx.track)
      // the track its playing is not guaranteed in the playlist
      this.nowPlaying = this.playlist[index] || { info: {} }
      if (index !== -1) this.playlist.splice(index, 1)
      this.textChannel.createMessage({
        content: i18n.t('voice.events.nowPlaying'),
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
      if (x.byRemote && x.code !== 4014) this.textChannel.createMessage(i18n.t('voice.events.disconnected'))
      this.destroy()
    })
  }

  async next (msg = {}) {
    if (msg.reason === 'REPLACED') return
    // the skip command uses this func too
    // if we dont do this, you end up skipping 2 songs
    // since trackEnd will also fire
    let nextup = this.playlist[0]
    // no shift, on(trackStart) does that
    if (nextup) {
      if (nextup.needsResolve) {
        logger.debug('I7S-PLAYLIST', `Resolving ${this.playlist[0].info.videoId} on the fly`)
        const data = await this._invidiousResolve(this.playlist[0].info.videoId)
        if (data.loadType === 'TRACK_LOADED') {
          this.playlist[0] = data.tracks[0]
          nextup = data.tracks[0]
        } else {
          logger.debug('I7S-PLAYLIST', `Couldn't load ${this.playlist[0].info.videoId}, removing and skipping`)
          this.playlist.splice(0, 1)
          return this.next()
        }
      }
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

  async _invidiousResolve (videoId, proxy = false, invidiousHost = process.env.INVIDIOUS_HOST) {
    const authorImg = (data) => {
      if (!data.authorThumbnails[0].url || data.authorThumbnails[0].url.length < 1) return undefined // this can happen sometimes
      else if (!data.authorThumbnails[0].url.startsWith('https:')) return `https:${data.authorThumbnails[0].url}`
      return data.authorThumbnails[0].url
    }
    const SA = require('superagent')
    const info = await SA.get(`${invidiousHost}/api/v1/videos/${videoId}`)
    let lavaresp
    if (info.body.liveNow) {
      // lavaresp = await this._encoder.node.loadTracks(`${info.body.hlsUrl}?local=true`)
      return { loadType: 'LOAD_FAILED', exception: { severity: 'COMMON', message: 'Unable to play livestreams at the moment' } }
    } else {
      const itags = ['251', '250', '249', '171', '141', '140', '139']
      const tag = info.body.adaptiveFormats.find(x => itags.includes(x.itag))
      lavaresp = await this._encoder.node.loadTracks(`${invidiousHost}/latest_version?id=${videoId}&itag=${tag.itag}${proxy ? '&local=true' : ''}`)
    }
    if (lavaresp.loadType !== 'TRACK_LOADED' && !proxy) {
      logger.debug('I7S', `Retrying resolve for ${videoId} with Invidious host ${invidiousHost} with proxying enabled`)
      return this._invidiousResolve(videoId, true)
    }
    if (lavaresp.loadType !== 'TRACK_LOADED' && proxy) {
      if (!process.env.INVIDIOUS_ALTERNATIVE_SERVERS) return lavaresp
      const proxys = JSON.parse(process.env.INVIDIOUS_ALTERNATIVE_SERVERS)
      if (proxys.indexOf(invidiousHost) === proxys.length - 1) {
        logger.debug('I7S', `All alternative servers exhausted! Abandoning resolve for ${videoId}`)
        return lavaresp
      }
      // dont have to try to rotate if all alternative servers are exhausted
      const altServer = (proxys.indexOf(invidiousHost) !== -1) ? proxys[proxys.indexOf(invidiousHost) + 1] : proxys[0]
      logger.debug('I7S', `Retrying resolve for ${videoId} with alternative Invidious host ${altServer}`)
      return this._invidiousResolve(videoId, false, altServer)
    }
    logger.debug('I7S', `Resolve for ${videoId} succeeded with Invidious host ${invidiousHost}, proxy ${proxy}`)
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

  async _invidiousPlaylist (id, page = 1, invidiousHost = process.env.INVIDIOUS_HOST) {
    const authorImg = (data) => {
      if (!data.authorThumbnails[0].url || data.authorThumbnails[0].url.length < 1) return undefined // this can happen sometimes
      else if (!data.authorThumbnails[0].url.startsWith('https:')) return `https:${data.authorThumbnails[0].url}`
      return data.authorThumbnails[0].url
    }
    const SA = require('superagent')
    const resp = await SA.get(`${invidiousHost}/api/v1/playlists/${id}?page=${page}`)
    // const result = await Promise.allSettled(resp.body.videos.map(x => this._invidiousResolve(x.videoId)))
    // if (this.fresh) this.add((await this._invidiousResolve(resp.body.videos[0].videoId)).tracks[0])
    this.addMany(resp.body.videos.map(x => {
      return {
        info: {
          ...x,
          uri: `https://youtu.be/${x.videoId}`
        },
        needsResolve: true
      }
    }))
    // invidious returns 99 results per api call, so we need to paginate if there are more than 99 songs
    if (resp.body.videos.length === 99 && resp.body.videoCount > (99 * page)) this._invidiousPlaylist(id, page + 1)
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
