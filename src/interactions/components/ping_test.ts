import { Interaction } from 'detritus-client/lib/structures'
import { cache } from '../../cache'
import { SelectMenuComponent } from '../../classes/SelectMenuComponent'

const interaction = new SelectMenuComponent({
  id: 'ping_test',
  data: [
    {
      label: 'Ping',
      value: 'ping',
      description: 'Pings the bot.'
    }
  ],
  fn: async (payload: Interaction) => {
    await payload.respond({
      type: 4,
      data: {
        content: 'Hello world!',
        flags: 64
      }
    })
  }
})

cache.components.set(interaction.id, interaction)

export default interaction
