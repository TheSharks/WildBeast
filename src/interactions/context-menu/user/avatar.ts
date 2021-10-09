import { Interaction } from 'detritus-client'
import { MessageFlags } from 'detritus-client/lib/constants'

import { BaseContextMenuUserCommand, ContextMenuUserArgs } from '../../base'

export default class InformationCommand extends BaseContextMenuUserCommand {
  name = 'Avatar'

  async run (context: Interaction.InteractionContext, args: ContextMenuUserArgs): Promise<void> {
    await context.editOrRespond({
      embed: {
        description: `${args.user.mention}'s avatar`,
        image: {
          url: `${args.user.avatarUrl}?size=512`
        }
      },
      flags: MessageFlags.EPHEMERAL
    })
  }
}
