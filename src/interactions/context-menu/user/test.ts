import { Interaction } from 'detritus-client'

import { BaseContextMenuUserCommand, ContextMenuUserArgs } from '../../base'

export default class InformationCommand extends BaseContextMenuUserCommand {
  name = 'Test'

  async run (context: Interaction.InteractionContext, args: ContextMenuUserArgs): Promise<void> {
    return await context.editOrRespond('wow')
  }
}
