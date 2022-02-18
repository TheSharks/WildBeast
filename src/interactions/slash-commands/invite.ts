import { Interaction } from 'detritus-client'
import { MessageFlags } from 'detritus-client/lib/constants'

import { BaseSlashCommand } from '../base'

export default class InviteCommand extends BaseSlashCommand {
  name = 'invite'
  description = this.translateThis('metadata.description')

  async run (context: Interaction.InteractionContext): Promise<void> {
    if (process.env.WILDBEAST_INVITE_OVERRIDE !== undefined) {
      await context.editOrRespond({
        content: this.translateThis('done', {
          invite: process.env.WILDBEAST_INVITE_OVERRIDE
        }),
        flags: MessageFlags.EPHEMERAL
      })
      return
    }
    if (!context.client.application!.botPublic) {
      if (context.client.application!.team !== undefined) {
        const teamowner = context.client.application!.team.owner!
        await context.editOrRespond({
          content: this.translateThis('private', {
            owner: `${teamowner.username}#${teamowner.discriminator}`
          }),
          flags: MessageFlags.EPHEMERAL
        })
      } else {
        const owner = context.client.application!.owner
        await context.editOrRespond({
          content: this.translateThis('private', {
            owner: `${owner.username}#${owner.discriminator}`
          }),
          flags: MessageFlags.EPHEMERAL
        })
      }
    } else {
      await context.editOrRespond({
        content: this.translateThis('done', {
          invite: `https://discordapp.com/oauth2/authorize?&client_id=${context.client.application!.id}&scope=bot%20applications.commands`
        }),
        flags: MessageFlags.EPHEMERAL
      })
    }
  }
}
