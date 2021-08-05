import { GatewayClientEvents } from 'detritus-client'
import { ClientEvents } from 'detritus-client/lib/constants'
import { InteractionDataApplicationCommand, InteractionDataComponent } from 'detritus-client/lib/structures'
import { cache } from '../cache'
import { Command } from '../classes/Command'
import { trace, warn } from '../components/logger'

cache.events.set(ClientEvents.INTERACTION_CREATE, async function (payload: GatewayClientEvents.ClusterEvent & GatewayClientEvents.InteractionCreate) {
  const interaction =
    payload.interaction.isFromApplicationCommand
      ? cache.commands.get((payload.interaction.data as InteractionDataApplicationCommand).id)
      : cache.components.get((payload.interaction.data as InteractionDataComponent).customId)
  if (interaction !== undefined) {
    if (interaction instanceof Command) await interaction.processInteraction(payload.interaction, this)
    else await interaction.call(this, payload.interaction)
  } else {
    warn('Unhandled interaction!', 'Interactions')
    trace(payload, 'Interactions')
  }
})
