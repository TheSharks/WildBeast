import { ShardClient } from 'detritus-client'
import { Interaction } from 'detritus-client/lib/structures'
import { cache } from '../../cache'
import { Command } from '../../classes/Command'

const command = new Command({
  name: 'ping',
  description: "Checks the bot's status.",
  options: [
    { name: 'user', description: 'The user to ping.', type: 1 }
  ],
  function: {
    run: async function (interaction: Interaction, shard: ShardClient) {
      const msg = await this.safeReply(interaction, {
        content: 'Pong! `...`'
      })
      const ping = await shard.ping()
      await this.safeReply(interaction, {
        content: `Pong! \`RTT: ${Math.floor(msg.timestamp.getTime() - interaction.createdAt.getTime())}ms, GW: ${ping.gateway}ms, REST: ${ping.rest}ms\``
      })
    }
  }
})

cache.commands.set(command.name, command)
export default command
