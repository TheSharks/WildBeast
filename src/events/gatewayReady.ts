import { ClientEvents } from 'detritus-client/lib/constants'
import { cache } from '../cache'
import { info } from '../components/logger'

cache.events.set(ClientEvents.GATEWAY_READY, async function () {
  info('Gateway ready', 'Gateway')
  if (process.env.LAVALINK_AUTODISCOVERY !== undefined) {
    await cache.lavalink.autoDiscovery(JSON.parse(process.env.LAVALINK_AUTODISCOVERY))
  } else {
    cache.lavalink.connect(JSON.parse(process.env.LAVALINK_NODES ?? '[]'))
  }
})
