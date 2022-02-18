import { Interaction } from 'detritus-client'
import { ApplicationCommandOptionTypes } from 'detritus-client/lib/constants'
import { translate } from '../../utils/i18n'

import { BaseSlashCommand } from '../base'

export interface CommandArgs {
  dice?: number
  sides?: number
}

export default class DiceCommand extends BaseSlashCommand {
  name = 'dice'
  description = this.translateThis('metadata.description')

  constructor () {
    super({
      options: [
        {
          type: ApplicationCommandOptionTypes.INTEGER,
          name: 'dice',
          description: translate('slash-commands.dice.metadata.options.dice'),
          required: false
        },
        {
          type: ApplicationCommandOptionTypes.INTEGER,
          name: 'sides',
          description: translate('slash-commands.dice.metadata.options.sides'),
          required: false
        }
      ]
    })
  }

  async run (context: Interaction.InteractionContext, args: CommandArgs): Promise<void> {
    const { dice, sides } = args
    const diceCount = dice ?? 1
    const diceSides = sides ?? 6

    let total = 0
    for (let i = 0; i < diceCount; i++) {
      total += Math.floor(Math.random() * diceSides) + 1
    }

    await context.editOrRespond(this.translateThis('response', {
      username: context.user.username,
      diceCount,
      diceSides,
      total
    }))
  }
}
