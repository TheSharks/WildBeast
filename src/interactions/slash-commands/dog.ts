import { Interaction } from 'detritus-client'
import { ComponentContext, Components, Embed } from 'detritus-client/lib/utils'
import fetch from 'node-fetch'

import { BaseSlashCommand } from '../base'

export default class RandomDogCommand extends BaseSlashCommand {
  name = 'dog'
  description = this.translateThis('metadata.description')

  async run (context: Interaction.InteractionContext | ComponentContext): Promise<void> {
    const components = new Components({
      timeout: 5 * (60 * 1000),
      onTimeout: async () => await context.editOrRespond({ components: [] })
    })
    components.addButton({
      emoji: '🔄',
      run: async (componentContext: ComponentContext) => {
        await this.run(componentContext)
      }
    })
    const { message } = await (await fetch('https://dog.ceo/api/breeds/image/random')).json()
    const { fact } = await (await fetch('https://some-random-api.ml/facts/dog')).json()
    const embed = new Embed()
      .setDescription(fact)
      .setImage(message)
      .setFooter('Powered by dog.ceo')
    await context.editOrRespond({
      embed,
      components
    })
  }
}
