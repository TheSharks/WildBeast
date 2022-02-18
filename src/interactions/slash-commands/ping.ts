import { Interaction } from 'detritus-client'

import { BaseSlashCommand } from '../base'

export default class PingCommand extends BaseSlashCommand {
  name = 'ping'
  // description = this.translateThis('metadata.description')

  async run (context: Interaction.InteractionContext): Promise<void> {
    const { gateway, rest } = await context.client.ping()
    await context.editOrRespond(`Pong! (gateway: ${gateway}ms) (rest: ${rest}ms)`)
  }
}
