import type { EvaluationContext } from '@openfeature/server-sdk'
import type { BaseInteraction } from 'discord.js'

// Per-shard value stays in module isolate (workers share process.env).
let taskShardId: string | undefined

export function setTaskFlagShardId(shardId: string | undefined): void {
  taskShardId = shardId
}

export interface InteractionFlagContextOptions {
  command?: string
  subcommand?: string
  /** Targeting hint only, never proof of payment; evaluation.mts splits anyTier (flags) from enforced tier (limits). */
  tier?: string
  /** Override the natural guild-first targeting key (used by user limits). */
  targetingKey?: string
}

// Shared interaction context; omit unset fields so OFREP sees "not applicable" distinctly.
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
    ...(taskShardId ? { shardId: taskShardId } : {}),
    environment: process.env.NODE_ENV ?? 'development',
  }
}
