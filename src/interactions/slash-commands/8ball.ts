import { Interaction } from 'detritus-client'
import { translate, traverse } from '../../utils/i18n'

import { BaseSlashCommand } from '../base'

export default class EightBallCommand extends BaseSlashCommand {
  description = 'Ask the magic 8-ball for advice'
  name = '8ball'

  async run (context: Interaction.InteractionContext): Promise<void> {
    const length = traverse('commands.8ball.choices.length')
    await context.editOrRespond(translate('commands.8ball.prefix', { response: translate(`commands.8ball.choices.${Math.floor(Math.random() * length)}`) }))
  }
}
