import { ClusterClient } from 'detritus-client'
import { GatewayIntents } from 'detritus-client-socket/lib/constants'
import { ClientEvents } from 'detritus-client/lib/constants'
import { cache } from '../cache'
import { trace } from '../internal/logger'

interface ModClient extends ClusterClient {
  _defaultEmit: (this: ModClient, ...args: any[]) => boolean
}

const client = new ClusterClient(process.env.BOT_TOKEN ?? '', {
  gateway: {
    compress: true,
    guildSubscriptions: false,
    intents: [
      GatewayIntents.GUILDS,
      GatewayIntents.GUILD_MESSAGES,
      GatewayIntents.GUILD_VOICE_STATES
      // GatewayIntents.DIRECT_MESSAGES
    ]
  }
}) as ModClient

client._defaultEmit = client.hookedEmit
client.hookedEmit = function hookedEmit (shard, name: ClientEvents, data) {
  if (cache.events.has(name)) {
    const event = Object.assign({}, data, { shard })
    trace(data, name)
    // eslint-disable-next-line no-void
    void cache.events.get(name)!.apply(shard, [event])
  }
  return client._defaultEmit.apply(this, Array.from(arguments))
}

if ((process.env.WILDBEAST_SHARDING_START != null) && (process.env.WILDBEAST_SHARDING_END != null) && (process.env.WILDBEAST_SHARDING_TOTAL != null)) {
  client.setShardCount(+process.env.WILDBEAST_SHARDING_TOTAL)
  client.setShardStart(+process.env.WILDBEAST_SHARDING_START)
  client.setShardEnd(+process.env.WILDBEAST_SHARDING_END)
}

export default client
