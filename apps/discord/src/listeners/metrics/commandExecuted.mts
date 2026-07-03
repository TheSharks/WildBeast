import type { ChatInputCommandSuccessPayload } from '@sapphire/framework'
import { Listener } from '@sapphire/framework'
import {
  type Attributes,
  DURATION_SECONDS_BOUNDARIES,
  metrics,
  resolveShardId,
} from '@thesharks/analytics'

const meter = metrics.getMeter('@thesharks/discord')
const commandCounter = meter.createCounter('discord_commands_total', {
  description: 'Total number of Discord commands executed',
})
const executionTime = meter.createHistogram(
  'discord_command_duration_seconds',
  {
    description: 'Time since interaction creation (includes network latency)',
    unit: 's',
    advice: { explicitBucketBoundaries: DURATION_SECONDS_BOUNDARIES },
  },
)

function resolveScope(payload: ChatInputCommandSuccessPayload): 'guild' | 'dm' {
  return payload.interaction.inGuild() ? 'guild' : 'dm'
}

function createLabels(
  payload: ChatInputCommandSuccessPayload,
  shardId: string,
): Attributes {
  return {
    command: payload.command.name,
    shard_id: shardId,
    scope: resolveScope(payload),
  }
}

export class CommandExecutedListener extends Listener {
  public constructor(
    context: Listener.LoaderContext,
    options: Listener.Options,
  ) {
    super(context, {
      ...options,
      event: 'chatInputCommandSuccess',
    })
  }

  public run(payload: ChatInputCommandSuccessPayload) {
    const shardId = resolveShardId(payload.interaction, this)
    const labels = createLabels(payload, shardId)

    commandCounter.add(1, labels)

    const duration = Date.now() - payload.interaction.createdTimestamp
    const durationSeconds = Math.max(0, duration) / 1000
    executionTime.record(durationSeconds, {
      ...labels,
      duration_scope: 'interaction',
    })
  }
}
