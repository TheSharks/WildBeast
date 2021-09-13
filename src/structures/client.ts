import { ClusterClient, InteractionCommandClient } from 'detritus-client'
import { GatewayIntents } from 'detritus-client-socket/lib/constants'
interface ModClient extends InteractionCommandClient {
  client: ClusterClient
}

const client = new InteractionCommandClient(process.env.BOT_TOKEN ?? '', {
  useClusterClient: true,
  gateway: {
    compress: true,
    guildSubscriptions: false,
    intents: [
      GatewayIntents.GUILDS
    ]
  }
}) as ModClient

if ((process.env.WILDBEAST_SHARDING_START != null) && (process.env.WILDBEAST_SHARDING_END != null) && (process.env.WILDBEAST_SHARDING_TOTAL != null)) {
  client.client.setShardCount(+process.env.WILDBEAST_SHARDING_TOTAL)
  client.client.setShardStart(+process.env.WILDBEAST_SHARDING_START)
  client.client.setShardEnd(+process.env.WILDBEAST_SHARDING_END)
}

export default client
