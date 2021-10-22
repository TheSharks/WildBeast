import { Interaction } from 'detritus-client'
import fetch from 'node-fetch'

import { BaseSlashCommand } from '../base'

export default class AdviceCommand extends BaseSlashCommand {
  description = 'Get some helpful advice'
  name = 'advice'

  async run (context: Interaction.InteractionContext): Promise<void> {
    const advice = await (await fetch('https://api.adviceslip.com/advice')).json()
    await this.safeReply(context, advice.slip.advice)
  }
}
