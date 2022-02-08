import { ClientEvents } from 'detritus-client/lib/constants'
import client from '../structures/client'
import { add } from '../utils/elastic'
import { info } from '../utils/logger'

client.client.subscribe(ClientEvents.GATEWAY_RESUMED, async function (payload) {
  info('Gateway resumed', `Gateway - shard ${payload.shard.shardId}`)
  add({
    type: 'gateway',
    event: 'resumed',
    shard: payload.shard.shardId,
    trace: payload.raw._trace,
    session: payload.shard.gateway.sessionId
  })
})
