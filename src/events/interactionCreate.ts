import { GatewayClientEvents } from 'detritus-client'
import { ClientEvents } from 'detritus-client/lib/constants'
import { InteractionDataApplicationCommand, InteractionDataComponent } from 'detritus-client/lib/structures'
import { cache } from '../cache'
import { ButtonComponent } from '../classes/ButtonComponent'
import { Command } from '../classes/Command'
import { SelectMenuComponent } from '../classes/SelectMenuComponent'
import { trace, warn } from '../internal/logger'

cache.events.set(ClientEvents.INTERACTION_CREATE, async function (payload: GatewayClientEvents.ClusterEvent & GatewayClientEvents.InteractionCreate) {
  const interaction =
    payload.interaction.isFromApplicationCommand
      ? cache.commands.get((payload.interaction.data as InteractionDataApplicationCommand).id)
      : cache.components.get((payload.interaction.data as InteractionDataComponent).customId)
  if (interaction !== undefined) {
    if (interaction instanceof Command) await interaction.processInteraction(payload.interaction, this)
    if (interaction instanceof ButtonComponent) await interaction.fn.call(this, payload.interaction)
    if (interaction instanceof SelectMenuComponent) await interaction.fn.call(this, payload.interaction)
  } else {
    warn('Unhandled interaction!', 'Interactions')
    trace(payload, 'Interactions')
  }
})
