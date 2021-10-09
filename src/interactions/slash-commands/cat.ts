import { Interaction } from 'detritus-client'
import { ComponentContext, Components, Embed } from 'detritus-client/lib/utils'
import fetch from 'node-fetch'

import { BaseSlashCommand } from '../base'

export default class RandomCatCommand extends BaseSlashCommand {
  name = 'cat'
  description = 'Sends a random cat image'

  async run (context: Interaction.InteractionContext | ComponentContext): Promise<void> {
    const components = new Components({
      timeout: 5 * (60 * 1000),
      onTimeout: async () => await context.editOrRespond({ components: [] })
    })
    components.addButton({
      label: '🔄',
      run: async (componentContext: ComponentContext) => {
        await this.run(componentContext)
      }
    })
    const { fact } = await (await fetch('https://catfact.ninja/fact')).json()
    const embed = new Embed()
      .setDescription(fact)
      .setImage(`https://cataas.com/cat?${context.interaction.id}`) // cache busting
      .setFooter('Powered by cataas.com')
    await context.editOrRespond({
      embed,
      components
    })
  }
}
