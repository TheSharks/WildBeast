import { GatewayClientEvents } from 'detritus-client'
import { ClientEvents } from 'detritus-client/lib/constants'
import { InteractionDataApplicationCommand, InteractionDataComponent } from 'detritus-client/lib/structures'
import { cache } from '../cache'
import { Command } from '../classes/Command'
import { ComponentBase } from '../classes/ComponentBase'
import { trace, warn } from '../internal/logger'

cache.events.set(ClientEvents.INTERACTION_CREATE, async function (payload: GatewayClientEvents.ClusterEvent & GatewayClientEvents.InteractionCreate) {
  const interaction =
    payload.interaction.isFromApplicationCommand
      ? cache.commands.get((payload.interaction.data as InteractionDataApplicationCommand).id)
      : cache.components.get((payload.interaction.data as InteractionDataComponent).customId)
  if (interaction !== undefined) {
    if (interaction instanceof Command) return await interaction.processInteraction(payload.interaction, this)
    if (interaction instanceof ComponentBase) return await interaction.run(payload.interaction, this)
    warn('Got a declared interaction which we\'re unable to handle?', 'Interactions')
    trace(payload._raw, 'Interactions')
  } else {
    warn('Got an interaction with no handler declared!', 'Interactions')
    trace(payload._raw, 'Interactions')
  }
})
