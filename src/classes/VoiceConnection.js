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
        content: 'Now playing',
        embed: {
          url: this.nowPlaying.info.uri,
          title: this.nowPlaying.info.title || '[Unknown!]',
          author: {
            name: this.nowPlaying.info.author || '[Unknown!]'
          }
        }
      })
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

  destroy () {
    return this._encoder.disconnect()
  }

  resolve (ctx) {
    return this._encoder.node.loadTracks(ctx)
  }

  add (ctx) {
    this.playlist.push(ctx)
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
