import { PlayerEvent } from '@lavaclient/types'
import { Player } from '@thesharks/tyr'
import { ChannelGuildText } from 'detritus-client/lib/structures'

interface PlaylistItem {
  track: string
  info: {
    title: string
    author: string
    length: number
    uri: string
    identifier: string
    isSeekable: boolean
    isStream: boolean
    position: number
    image: string
    authorURL: string
    authorImage: string
  }
  i7s: {
    otf: boolean
  }
}

export interface VoiceConnection {
  playlist: PlaylistItem[]
  controllers: Set<string>
  textChannel: ChannelGuildText
  encoder: Player
}

export class VoiceConnection {
  constructor (encoder: Player) {
    this.encoder = encoder
  }

  shuffle (): void { // https://stackoverflow.com/a/6274381
    for (let i = this.playlist.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.playlist[i], this.playlist[j]] = [this.playlist[j], this.playlist[i]]
    }
  }

  destroy (): void {
    this.encoder.disconnect()
  }

  async next (msg?: PlayerEvent): Promise<PlaylistItem | undefined> {
    if (this.playlist.length > 0) {
      const { track, i7s } = this.playlist[0]
      if (i7s.otf) {
        // todo
      } else {
        this.encoder.play(track)
      }
      return this.playlist[0]
    }
  }
}
