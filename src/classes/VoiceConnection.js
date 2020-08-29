module.exports = class VoiceConnection {
  constructor (opts) {
    this.id = opts.id
    this.playlist = []
    this.controllers = opts.controllers
    this._encoder = opts.encoder
    this.fresh = true
    this.textChannel = opts.textChannel

    this._encoder.on('trackEnd', this.next.bind(this))
    this._encoder.on('trackError', x => {
      this.textChannel.createMessage(`The track I'm trying to play broke! \`${x.error}\``)
      this.next.bind(this)
    })
    this._encoder.on('trackStuck', x => {
      this.textChannel.createMessage('Seems the track got stuck, automatically skipping it...')
      this.next.bind(this)
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
          ...(this.nowPlaying.info.image ? { image: { url: this.nowPlaying.info.image } } : {})
        }
      })
    })
    this._encoder.once('disconnected', () => {
      this.textChannel.createMessage('I got disconnected from the voice channel, ending playback')
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
    ctx = ctx.trim()
    const ytreg = /(?:https?:\/\/)?(?:www\.)?youtu(?:.be\/|be\.com\/watch\?v=)(\w{11})/
    if (ytreg.test(ctx) && process.env.INVIDIOUS_HOST) {
      const videoid = ctx.match(ytreg)[1]
      const SA = require('superagent')
      const resp = await SA.get(`${process.env.INVIDIOUS_HOST}/api/v1/videos/${videoid}?fields=author,title,authorThumbnails,authorUrl`)
      const lavaresp = await this._encoder.node.loadTracks(`${process.env.INVIDIOUS_HOST}/latest_version?id=${videoid}&itag=250&local=true`)
      lavaresp.tracks[0].info = {
        ...lavaresp.tracks[0].info,
        author: resp.body.author,
        title: resp.body.title,
        uri: `https://youtu.be/${videoid}`,
        image: `https://i.ytimg.com/vi/${videoid}/hqdefault.jpg`,
        authorImage: (resp.body.authorThumbnails[0].url.startsWith('https:')) ? resp.body.authorThumbnails[0].url : `https:${resp.body.authorThumbnails[0].url}`,
        authorURL: `https://youtube.com${resp.body.authorUrl}`
      }
      return lavaresp
    }
    try {
      // eslint-disable-next-line no-new
      new URL(ctx)
      return this._encoder.node.loadTracks(ctx)
    } catch (_) {
      return this._encoder.node.loadTracks(`scsearch:${ctx}`)
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
}
