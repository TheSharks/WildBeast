import { Interaction } from 'detritus-client'
import fetch from 'node-fetch'

import { BaseSlashCommand } from '../base'

export default class AdviceCommand extends BaseSlashCommand {
  name = 'advice'
  description = this.translateThis('metadata.description')

  async run (context: Interaction.InteractionContext): Promise<void> {
    const advice = await (await fetch('https://api.adviceslip.com/advice')).json()
    await context.editOrRespond(advice.slip.advice)
  }
}
