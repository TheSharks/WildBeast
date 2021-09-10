import { ClientEvents } from 'detritus-client/lib/constants'
import { InteractionDataApplicationCommand, InteractionDataComponent } from 'detritus-client/lib/structures'
import client from '../components/client'
import { info } from '../internal/logger'
import * as Sentry from '@sentry/node'

client.client.on(ClientEvents.INTERACTION_CREATE, async function (payload) {
  // Sentry.startTransaction({
  //   op: 'interaction_create',
  //   name: payload.interaction.id
  // })
  if (payload.interaction.isFromApplicationCommand) {
    info(`Got a command interaction for ${(payload.interaction.data as InteractionDataApplicationCommand).name}`, 'interactionCreate')
  } else if (payload.interaction.isFromMessageComponent) {
    info(`Got a component interaction for ${(payload.interaction.data as InteractionDataComponent).customId}`, 'interactionCreate')
  }
})
