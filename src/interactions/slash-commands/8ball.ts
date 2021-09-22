import { Interaction } from 'detritus-client'
import { t, traverse } from '../../utils/i18n'

import { BaseSlashCommand } from '../base'

export default class EightBallCommand extends BaseSlashCommand {
  description = 'Ask the magic 8-ball for advice'
  name = '8ball'

  async run (context: Interaction.InteractionContext): Promise<void> {
    const length = traverse('commands.8ball.choices.length')
    await this.safeReply(context, t('commands.8ball.prefix', { response: t(`commands.8ball.choices.${Math.floor(Math.random() * length)}`) }))
  }
}
