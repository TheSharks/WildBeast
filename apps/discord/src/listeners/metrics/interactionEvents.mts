import { ApplyOptions } from '@sapphire/decorators'
import type { ListenerOptions } from '@sapphire/framework'
import { Events, Listener } from '@sapphire/framework'
import {
  type Attributes,
  DURATION_SECONDS_BOUNDARIES,
  metrics,
  resolveShardId,
} from '@thesharks/analytics'
import type { ClientEvents, Interaction } from 'discord.js'
import { InteractionType } from 'discord.js'
import { resolveInteractionScope } from '../../utils/tracing.mjs'

const meter = metrics.getMeter('@thesharks/discord')
const buttonCounter = meter.createCounter('discord_button_interaction_total', {
  description: 'Total number of button interactions',
})
const buttonDuration = meter.createHistogram(
  'discord_button_duration_seconds',
  {
    description: 'Time since button interaction creation',
    unit: 's',
    advice: { explicitBucketBoundaries: DURATION_SECONDS_BOUNDARIES },
  },
)
const selectMenuCounter = meter.createCounter(
  'discord_select_menu_interaction_total',
  {
    description: 'Total number of select menu interactions',
  },
)
const selectMenuDuration = meter.createHistogram(
  'discord_select_menu_duration_seconds',
  {
    description: 'Time since select menu interaction creation',
    unit: 's',
    advice: { explicitBucketBoundaries: DURATION_SECONDS_BOUNDARIES },
  },
)
const autocompleteCounter = meter.createCounter(
  'discord_autocomplete_interaction_total',
  {
    description: 'Total number of autocomplete interactions',
  },
)
const autocompleteDuration = meter.createHistogram(
  'discord_autocomplete_duration_seconds',
  {
    description: 'Time since autocomplete interaction creation',
    unit: 's',
    advice: { explicitBucketBoundaries: DURATION_SECONDS_BOUNDARIES },
  },
)
const modalSubmitCounter = meter.createCounter('discord_modal_submit_total', {
  description: 'Total number of modal submit interactions',
})
const modalSubmitDuration = meter.createHistogram(
  'discord_modal_submit_duration_seconds',
  {
    description: 'Time since modal submit interaction creation',
    unit: 's',
    advice: { explicitBucketBoundaries: DURATION_SECONDS_BOUNDARIES },
  },
)

/**
 * Custom ids commonly embed per-entity data after a ':' separator; label the
 * static prefix only so metric cardinality stays bounded.
 */
function componentKey(customId: string): string {
  const separator = customId.indexOf(':')
  const key = separator === -1 ? customId : customId.slice(0, separator)
  return key.slice(0, 64)
}

function componentLabels(
  listener: Listener,
  interaction: Interaction & { customId: string },
): Attributes {
  return {
    shard_id: resolveShardId(interaction, listener),
    custom_id: componentKey(interaction.customId),
    scope: resolveInteractionScope(interaction),
  }
}

// Pieces default their name to the file name; multiple listeners in one file
// need explicit names or each insert unloads the previous one.
@ApplyOptions<ListenerOptions>({
  name: 'buttonInteractionMetrics',
  event: Events.InteractionCreate,
})
export class InteractionCreateListener extends Listener {
  public run(...[interaction]: ClientEvents['interactionCreate']): void {
    if (interaction.type !== InteractionType.MessageComponent) {
      return
    }

    if (!interaction.isButton()) {
      return
    }

    const labels = componentLabels(this, interaction)
    buttonCounter.add(1, labels)

    const duration = Date.now() - interaction.createdTimestamp
    buttonDuration.record(Math.max(0, duration) / 1000, labels)
  }
}

@ApplyOptions<ListenerOptions>({
  name: 'selectMenuInteractionMetrics',
  event: Events.InteractionCreate,
})
export class SelectMenuInteractionListener extends Listener {
  public run(...[interaction]: ClientEvents['interactionCreate']): void {
    if (interaction.type !== InteractionType.MessageComponent) {
      return
    }

    if (!interaction.isAnySelectMenu()) {
      return
    }

    const labels = componentLabels(this, interaction)
    selectMenuCounter.add(1, labels)

    const duration = Date.now() - interaction.createdTimestamp
    selectMenuDuration.record(Math.max(0, duration) / 1000, labels)
  }
}

@ApplyOptions<ListenerOptions>({
  name: 'autocompleteMetrics',
  event: Events.InteractionCreate,
})
export class AutocompleteMetricsListener extends Listener {
  public run(...[interaction]: ClientEvents['interactionCreate']): void {
    if (!interaction.isAutocomplete()) {
      return
    }

    const labels: Attributes = {
      shard_id: resolveShardId(interaction, this),
      command: interaction.commandName,
      scope: resolveInteractionScope(interaction),
    }
    autocompleteCounter.add(1, labels)

    const duration = Date.now() - interaction.createdTimestamp
    autocompleteDuration.record(Math.max(0, duration) / 1000, labels)
  }
}

@ApplyOptions<ListenerOptions>({
  name: 'modalSubmitMetrics',
  event: Events.InteractionCreate,
})
export class ModalSubmitListener extends Listener {
  public run(...[interaction]: ClientEvents['interactionCreate']): void {
    if (interaction.type !== InteractionType.ModalSubmit) {
      return
    }

    const labels = componentLabels(this, interaction)
    modalSubmitCounter.add(1, labels)

    const duration = Date.now() - interaction.createdTimestamp
    modalSubmitDuration.record(Math.max(0, duration) / 1000, labels)
  }
}
