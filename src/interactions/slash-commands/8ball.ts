import { Interaction } from 'detritus-client'
import { traverse } from '../../utils/i18n'

import { BaseSlashCommand } from '../base'

export default class EightBallCommand extends BaseSlashCommand {
  name = '8ball'
  description = this.translateThis('metadata.description')

  async run (context: Interaction.InteractionContext): Promise<void> {
    const length = traverse('slash-commands.8ball.choices.length')
    await context.editOrRespond(this.translateThis('prefix', { response: this.translateThis(`choices.${Math.floor(Math.random() * length)}`) }))
  }
}
