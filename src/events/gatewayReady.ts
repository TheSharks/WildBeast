import { ClientEvents } from 'detritus-client/lib/constants'
import client from '../structures/client'
import { add } from '../utils/elastic'
import { info } from '../utils/logger'

client.client.subscribe(ClientEvents.GATEWAY_READY, async function (payload) {
  info('Gateway ready', `Gateway - shard ${payload.shard.shardId}`)
  add({
    type: 'gateway',
    event: 'ready',
    shard: payload.shard.shardId,
    trace: payload.raw._trace,
    session: payload.raw.session_id
  })
})
