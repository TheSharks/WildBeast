import { ClientEvents } from 'detritus-client/lib/constants'
import client from '../structures/client'
import { warn } from '../utils/logger'

client.client.subscribe(ClientEvents.WARN, async function (data) {
  warn(data.error, 'Detritus')
})
