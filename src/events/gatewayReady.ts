import { ClientEvents } from 'detritus-client/lib/constants'
import { cache } from '../cache'
import { info } from '../components/logger'

cache.events.set(ClientEvents.GATEWAY_READY, function () {
  info('Gateway ready', 'Gateway')
  cache.lavalink.connect(JSON.parse(process.env.LAVALINK_NODES ?? '[]'))
})
