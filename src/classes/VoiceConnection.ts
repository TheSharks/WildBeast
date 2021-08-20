import { PlayerEvent, TrackEndEvent, TrackExceptionEvent, TrackStartEvent, TrackStuckEvent, WebSocketClosedEvent, Track } from '@lavaclient/types'
import { Player } from '@thesharks/tyr'
import { Channel } from 'detritus-client/lib/structures'
import { cache } from '../cache'
import { t } from '../internal/i18n'

interface PlaylistItem extends Track {
  extras: {
  }
}

export interface VoiceConnection {
  playlist: PlaylistItem[]
  nowPlaying?: PlaylistItem
  controllers: Set<string>
  textChannel: Channel
  encoder: Player
}

export class VoiceConnection {
  constructor (encoder: Player) {
    this.playlist = []
    this.controllers = new Set()
    this.encoder = encoder

    this.encoder.on('trackEnd', async (event: TrackEndEvent) => {
      if (event.reason === 'STOPPED') return
      if (this.playlist.length === 0) {
        return this.destroy()
      } else await this.next(event)
    })
    this.encoder.on('trackError', async (event: TrackExceptionEvent) => {
      await this.next(event)
    })
    this.encoder.on('trackStuck', async (event: TrackStuckEvent) => {
      await this.next(event)
    })
    this.encoder.on('trackStart', async (event: TrackStartEvent) => {
      const index = this.playlist.findIndex(p => p.track === event.track)
      if (index !== -1) {
        this.nowPlaying = this.playlist[index]
        this.playlist.splice(index, 1)
        await this.textChannel.createMessage({
          content: t('voice.events.nowPlaying'),
          embed: {
            url: this.nowPlaying.info.uri,
            title: this.nowPlaying.info.title,
            author: {
              name: this.nowPlaying.info.author
            }
          }
        })
      }
    })

    this.encoder.once('disconnected', async (event: WebSocketClosedEvent) => {
      // if (event.byRemote && event.code !== 4014) return
      this.destroy()
    })
  }

  shuffle (): void { // https://stackoverflow.com/a/6274381
    for (let i = this.playlist.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.playlist[i], this.playlist[j]] = [this.playlist[j], this.playlist[i]]
    }
  }

  destroy (): void {
    this.encoder.disconnect()
    cache.lavalink.delete(this.encoder.id)
  }

  async next (msg?: PlayerEvent): Promise<PlaylistItem | undefined> {
    if (this.playlist.length > 0) {
      const { track } = this.playlist[0]
      this.encoder.play(track)
      return this.playlist[0]
    }
  }
}
