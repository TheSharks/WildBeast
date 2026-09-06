import { ApplyOptions } from '@sapphire/decorators'
import type { ListenerOptions } from '@sapphire/framework'
import { Events, Listener } from '@sapphire/framework'
import { SubcommandPluginEvents } from '@sapphire/plugin-subcommands'
import { DURATION_SECONDS_BOUNDARIES, metrics } from '@thesharks/analytics'
import type { ClientEvents, CommandInteraction } from 'discord.js'
import {
  commandMetricLabels,
  interactionDurationSeconds,
} from '../../telemetry/spans.mjs'

const meter = metrics.getMeter('@thesharks/discord')
// Labels frozen by METRIC_CONTRACT['discord_context_commands_total'] and
// METRIC_CONTRACT['discord_context_command_duration_seconds'].
const contextCommandCounter = meter.createCounter(
  'discord_context_commands_total',
  { description: 'Total number of Discord context menu commands executed' },
)
const contextExecutionTime = meter.createHistogram(
  'discord_context_command_duration_seconds',
  {
    description:
      'Time since context menu command interaction creation (includes network latency)',
    unit: 's',
    advice: { explicitBucketBoundaries: DURATION_SECONDS_BOUNDARIES },
  },
)
// Labels frozen by METRIC_CONTRACT['discord_commands_total'].
const commandCounter = meter.createCounter('discord_commands_total', {
  description: 'Total number of Discord commands executed',
})
// Labels frozen by METRIC_CONTRACT['discord_command_duration_seconds'].
const executionTime = meter.createHistogram(
  'discord_command_duration_seconds',
  {
    description: 'Time since interaction creation (includes network latency)',
    unit: 's',
    advice: { explicitBucketBoundaries: DURATION_SECONDS_BOUNDARIES },
  },
)

function record(
  listener: Listener,
  interaction: CommandInteraction,
  command: string,
  subcommand?: string,
) {
  const labels = commandMetricLabels(interaction, command, listener, {
    ...(subcommand ? { subcommand } : {}),
  })
  commandCounter.add(1, labels)
  executionTime.record(interactionDurationSeconds(interaction), {
    ...labels,
    duration_scope: 'interaction',
  })
}

@ApplyOptions<ListenerOptions>({
  name: 'chatInputCommandSuccess',
  event: Events.ChatInputCommandSuccess,
})
export class ChatInputCommandSuccessListener extends Listener {
  public run(...[payload]: ClientEvents['chatInputCommandSuccess']) {
    record(this, payload.interaction, payload.command.name)
  }
}

@ApplyOptions<ListenerOptions>({
  name: 'contextMenuCommandSuccess',
  event: Events.ContextMenuCommandSuccess,
})
export class ContextMenuCommandSuccessListener extends Listener {
  public run(...[payload]: ClientEvents['contextMenuCommandSuccess']) {
    const labels = commandMetricLabels(
      payload.interaction,
      payload.command.name,
      this,
    )
    contextCommandCounter.add(1, labels)
    contextExecutionTime.record(
      interactionDurationSeconds(payload.interaction),
      { ...labels, duration_scope: 'interaction' },
    )
  }
}

/** The subcommand plugin owns the real success boundary for mapped methods. */
@ApplyOptions<ListenerOptions>({
  name: 'chatInputSubcommandSuccess',
  event: SubcommandPluginEvents.ChatInputSubcommandSuccess,
})
export class ChatInputSubcommandSuccessListener extends Listener {
  public run(
    ...[
      interaction,
      subcommand,
      payload,
    ]: ClientEvents['chatInputSubcommandSuccess']
  ) {
    this.container.app.experiments.complete('success')
    record(this, interaction, payload.command.name, subcommand.name)
  }
}
