import { Listener } from '@sapphire/framework'
import {
  type Attributes,
  DURATION_SECONDS_BOUNDARIES,
  metrics,
  resolveShardId,
} from '@thesharks/analytics'
import type { ClientEvents } from 'discord.js'

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

/**
 * Subcommand-based commands don't emit chatInputCommandSuccess; the
 * subcommands plugin emits its own event, so they need their own listener
 * to land in the same metrics.
 */
export class SubcommandExecutedListener extends Listener {
  public constructor(
    context: Listener.LoaderContext,
    options: Listener.Options,
  ) {
    super(context, {
      ...options,
      event: 'chatInputSubcommandSuccess',
    })
  }

  public run(
    ...[
      interaction,
      subcommand,
      payload,
    ]: ClientEvents['chatInputSubcommandSuccess']
  ) {
    const shardId = resolveShardId(interaction, this)
    const labels: Attributes = {
      command: payload.command.name,
      subcommand: subcommand.name,
      shard_id: shardId,
      scope: interaction.inGuild() ? 'guild' : 'dm',
    }

    commandCounter.add(1, labels)

    const duration = Date.now() - interaction.createdTimestamp
    const durationSeconds = Math.max(0, duration) / 1000
    executionTime.record(durationSeconds, {
      ...labels,
      duration_scope: 'interaction',
    })
  }
}
