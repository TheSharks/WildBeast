import { ClientEvents } from 'detritus-client/lib/constants'
import client from '../components/client'
import { info } from '../internal/logger'

client.client.subscribe(ClientEvents.GATEWAY_READY, async function () {
  info('Gateway ready', 'Gateway')
})
