import { ApplyOptions } from '@sapphire/decorators'
import type { ListenerOptions } from '@sapphire/framework'
import { Events, Listener } from '@sapphire/framework'
import { type Attributes, metrics } from '@thesharks/analytics'
import type { ClientEvents } from 'discord.js'
import { InteractionType } from 'discord.js'
import {
  attributesFromInteraction,
  spanName,
  withSpan,
} from '../../utils/tracing.mjs'

const meter = metrics.getMeter('@thesharks/discord')
const buttonCounter = meter.createCounter('discord_button_interaction_total', {
  description: 'Total number of button interactions',
})
const buttonDuration = meter.createHistogram(
  'discord_button_duration_seconds',
  {
    description: 'Time since button interaction creation',
    unit: 's',
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
  },
)

@ApplyOptions<ListenerOptions>({
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

    void withSpan(
      spanName('listener'),
      {
        'discord.listener.name': this.name,
        'discord.listener.event': Events.InteractionCreate,
        ...attributesFromInteraction(interaction, this),
        'discord.component.type': 'button',
        'discord.component.custom_id': interaction.customId,
      },
      () => {
        buttonCounter.add(1, {
          shard_id: String(interaction.guild?.shardId ?? 'unknown'),
          custom_id: interaction.customId,
          guild_id: interaction.guildId ?? undefined,
        })

        const duration = Date.now() - interaction.createdTimestamp
        const durationSeconds = Math.max(0, duration) / 1000
        buttonDuration.record(durationSeconds, {
          shard_id: String(interaction.guild?.shardId ?? 'unknown'),
          custom_id: interaction.customId,
          guild_id: interaction.guildId ?? undefined,
        })
      },
    )
  }
}

@ApplyOptions<ListenerOptions>({
  event: Events.InteractionCreate,
})
export class SelectMenuInteractionListener extends Listener {
  public run(...[interaction]: ClientEvents['interactionCreate']): void {
    if (interaction.type !== InteractionType.MessageComponent) {
      return
    }

    if (!interaction.isStringSelectMenu()) {
      return
    }

    void withSpan(
      spanName('listener'),
      {
        'discord.listener.name': this.name,
        'discord.listener.event': Events.InteractionCreate,
        ...attributesFromInteraction(interaction, this),
        'discord.component.type': 'select_menu',
        'discord.component.custom_id': interaction.customId,
      },
      () => {
        selectMenuCounter.add(1, {
          shard_id: String(interaction.guild?.shardId ?? 'unknown'),
          custom_id: interaction.customId,
          guild_id: interaction.guildId ?? undefined,
        })

        const duration = Date.now() - interaction.createdTimestamp
        const durationSeconds = Math.max(0, duration) / 1000
        selectMenuDuration.record(durationSeconds, {
          shard_id: String(interaction.guild?.shardId ?? 'unknown'),
          custom_id: interaction.customId,
          guild_id: interaction.guildId ?? undefined,
        })
      },
    )
  }
}

@ApplyOptions<ListenerOptions>({
  event: Events.InteractionCreate,
})
export class ModalSubmitListener extends Listener {
  public run(...[interaction]: ClientEvents['interactionCreate']): void {
    if (interaction.type !== InteractionType.ModalSubmit) {
      return
    }

    void withSpan(
      spanName('listener'),
      {
        'discord.listener.name': this.name,
        'discord.listener.event': Events.InteractionCreate,
        ...attributesFromInteraction(interaction, this),
        'discord.component.type': 'modal',
        'discord.component.custom_id': interaction.customId,
      },
      () => {
        modalSubmitCounter.add(1, {
          shard_id: String(interaction.guild?.shardId ?? 'unknown'),
          custom_id: interaction.customId,
          guild_id: interaction.guildId ?? undefined,
        })

        const duration = Date.now() - interaction.createdTimestamp
        const durationSeconds = Math.max(0, duration) / 1000
        modalSubmitDuration.record(durationSeconds, {
          shard_id: String(interaction.guild?.shardId ?? 'unknown'),
          custom_id: interaction.customId,
          guild_id: interaction.guildId ?? undefined,
        })
      },
    )
  }
}
