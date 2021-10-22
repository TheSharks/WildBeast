import { ClientEvents } from 'detritus-client/lib/constants'
import client from '../structures/client'
import { info } from '../utils/logger'

client.client.subscribe(ClientEvents.READY, async function () {
  info('Client ready', 'Gateway')
})
