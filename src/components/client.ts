import { ClusterClient } from 'detritus-client'
import { GatewayIntents } from 'detritus-client-socket/lib/constants'
import { cache } from '../cache'

interface ModClient extends ClusterClient {
  _defaultEmit: Function
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
client.hookedEmit = function hookedEmit () {
  if (cache.events.has(arguments[1])) {
    // eslint-disable-next-line no-void
    void cache.events.get(arguments[1])!.call(this, arguments)
  }
  return client._defaultEmit.apply(this, arguments)
}

if ((process.env.WILDBEAST_SHARDING_START != null) && (process.env.WILDBEAST_SHARDING_END != null) && (process.env.WILDBEAST_SHARDING_TOTAL != null)) {
  client.setShardCount(+process.env.WILDBEAST_SHARDING_TOTAL)
  client.setShardStart(+process.env.WILDBEAST_SHARDING_START)
  client.setShardEnd(+process.env.WILDBEAST_SHARDING_END)
}

export default client
