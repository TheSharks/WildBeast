import { ClientEvents } from 'detritus-client/lib/constants'
import { cache } from '../cache'

cache.events.set(ClientEvents.VOICE_SERVER_UPDATE, async function (payload) {
  cache.lavalink.voiceServerUpdate(payload)
})
