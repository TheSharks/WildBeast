import { ClientEvents } from 'detritus-client/lib/constants'
import client from '../structures/client'
import { info } from '../utils/logger'

client.client.subscribe(ClientEvents.GATEWAY_RESUMED, async function () {
  info('Gateway resumed', 'Gateway')
})
