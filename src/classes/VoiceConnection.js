module.exports = class VoiceConnection {
  constructor (opts) {
    this.id = opts.id
    this.playlist = []
    this.controllers = opts.controllers
    this._encoder = opts.encoder
    this.fresh = true
    this.textChannel = opts.textChannel

    this._encoder.on('trackEnd', this.next.bind(this))
  }

  next (msg = {}) {
    if (msg.reason === 'REPLACED') return
    // the skip command uses this func too
    // if we dont do this, you end up skipping 2 songs
    // since trackEnd will also fire
    const nextup = this.playlist.shift()
    if (nextup) {
      this._encoder.play(nextup.track)
      return nextup
    }
  }

  async resolveAndAdd (suffix) {
    const data = await this._encoder.node.loadTracks(suffix)
    this.playlist.push(data.tracks[0])
    if (this.fresh) {
      this.fresh = false
      this.next()
    }
    return data
  }
}
