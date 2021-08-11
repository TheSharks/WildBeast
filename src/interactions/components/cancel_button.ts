import { Interaction } from 'detritus-client/lib/structures'
import { ButtonStyle } from 'discord-api-types'
import { cache } from '../../cache'
import { ButtonComponent } from '../../classes/ButtonComponent'

const interaction = new ButtonComponent({
  id: 'cancel_button',
  data: {
    style: ButtonStyle.Danger,
    label: 'Cancel'
  },
  fn: async (payload: Interaction) => {
    await payload.editOrRespond({
      content: 'Cancelled',
      components: []
    })
  }
})

cache.components.set(interaction.id, interaction)

export default interaction
