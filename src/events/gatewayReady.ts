import { ClientEvents } from 'detritus-client/lib/constants'
import client from '../structures/client'
import { info } from '../utils/logger'

client.client.subscribe(ClientEvents.GATEWAY_READY, async function (payload) {
  info('Gateway ready', `Gateway - shard ${payload.shard.shardId}`)
})
