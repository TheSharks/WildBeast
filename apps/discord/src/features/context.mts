import type { EvaluationContext } from '@openfeature/server-sdk'
import type { BaseInteraction } from 'discord.js'

export interface InteractionFlagContextOptions {
  command?: string
  subcommand?: string
  tier?: string
  /** Override the natural guild-first targeting key (used by user limits). */
  targetingKey?: string
}

/**
 * The one interaction context shared by gates, experiments and remote limit
 * overrides. Optional fields are omitted rather than sent as undefined so an
 * OFREP service can distinguish "not applicable" from a real value.
 */
export function interactionFlagContext(
  interaction: BaseInteraction,
  options: InteractionFlagContextOptions = {},
): EvaluationContext {
  return {
    targetingKey:
      options.targetingKey ?? interaction.guildId ?? interaction.user.id,
    userId: interaction.user.id,
    ...(interaction.guildId ? { guildId: interaction.guildId } : {}),
    ...(options.tier ? { tier: options.tier } : {}),
    ...(options.command ? { command: options.command } : {}),
    ...(options.subcommand ? { subcommand: options.subcommand } : {}),
    ...(interaction.guild?.shardId !== undefined
      ? { shardId: String(interaction.guild.shardId) }
      : {}),
    ...(process.env.WILDBEAST_CLUSTER_ID
      ? { clusterId: process.env.WILDBEAST_CLUSTER_ID }
      : {}),
    environment: process.env.NODE_ENV ?? 'development',
  }
}

export function taskFlagContext(task: string): EvaluationContext {
  return {
    targetingKey: `task:${task}`,
    task,
    ...(process.env.WILDBEAST_CLUSTER_ID
      ? { clusterId: process.env.WILDBEAST_CLUSTER_ID }
      : {}),
    ...(process.env.SHARD_ID ? { shardId: process.env.SHARD_ID } : {}),
    environment: process.env.NODE_ENV ?? 'development',
  }
}
