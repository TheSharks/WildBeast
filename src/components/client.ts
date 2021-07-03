import { ClusterClient } from 'detritus-client'
import { GatewayIntents } from 'detritus-client-socket/lib/constants'

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
})

if ((process.env.WILDBEAST_SHARDING_START != null) && (process.env.WILDBEAST_SHARDING_END != null) && (process.env.WILDBEAST_SHARDING_TOTAL != null)) {
  client.setShardCount(+process.env.WILDBEAST_SHARDING_TOTAL)
  client.setShardStart(+process.env.WILDBEAST_SHARDING_START)
  client.setShardEnd(+process.env.WILDBEAST_SHARDING_END)
}

export default client
