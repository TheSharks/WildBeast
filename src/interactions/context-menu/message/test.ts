import { Interaction } from 'detritus-client'

import { BaseContextMenuMessageCommand, ContextMenuMessageArgs } from '../../base'

export default class InformationCommand extends BaseContextMenuMessageCommand {
  name = 'Test'

  async run (context: Interaction.InteractionContext, args: ContextMenuMessageArgs): Promise<void> {
    return await context.editOrRespond('wow')
  }
}
