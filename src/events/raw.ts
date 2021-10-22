import { ClientEvents } from 'detritus-client/lib/constants'
import client from '../structures/client'
import { trace } from '../utils/logger'

client.client.subscribe(ClientEvents.RAW, async function (data) {
  trace(data, data.t)
})
