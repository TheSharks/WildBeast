import { ClientEvents } from 'detritus-client/lib/constants'
import client from '../components/client'
import { trace } from '../internal/logger'

client.client.subscribe(ClientEvents.RAW, async function (data) {
  trace(data, data.t)
})
