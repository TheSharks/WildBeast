import type { ContextMenuCommandSuccessPayload } from '@sapphire/framework'
import { Listener } from '@sapphire/framework'
import {
  type Attributes,
  DURATION_SECONDS_BOUNDARIES,
  metrics,
  resolveShardId,
} from '@thesharks/analytics'

const meter = metrics.getMeter('@thesharks/discord')
const commandCounter = meter.createCounter('discord_context_commands_total', {
  description: 'Total number of Discord context menu commands executed',
})
const executionTime = meter.createHistogram(
  'discord_context_command_duration_seconds',
  {
    description:
      'Time since context menu command interaction creation (includes network latency)',
    unit: 's',
    advice: { explicitBucketBoundaries: DURATION_SECONDS_BOUNDARIES },
  },
)

function resolveScope(
  payload: ContextMenuCommandSuccessPayload,
): 'guild' | 'dm' {
  return payload.interaction.inGuild() ? 'guild' : 'dm'
}

function createLabels(
  payload: ContextMenuCommandSuccessPayload,
  shardId: string,
): Attributes {
  return {
    command: payload.command.name,
    shard_id: shardId,
    scope: resolveScope(payload),
  }
}

export class ContextMenuExecutedListener extends Listener {
  public constructor(
    context: Listener.LoaderContext,
    options: Listener.Options,
  ) {
    super(context, {
      ...options,
      event: 'contextMenuCommandSuccess',
    })
  }

  public run(payload: ContextMenuCommandSuccessPayload) {
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
