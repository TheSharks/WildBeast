import type { EvaluationContext } from '@openfeature/server-sdk'
import type { BaseInteraction } from 'discord.js'

// Worker threads share process.env, so a per-shard value must stay in the
// worker's module isolate rather than being written to SHARD_ID. index.mts
// resolves discord.js's process/worker-data variants once and sets it here.
let taskShardId: string | undefined

export function setTaskFlagShardId(shardId: string | undefined): void {
  taskShardId = shardId
}

export interface InteractionFlagContextOptions {
  command?: string
  subcommand?: string
  /**
   * Premium tier for targeting. Gate contexts carry the anyTier (best of
   * user/guild); limit evaluations carry the scope-resolved enforcement
   * tier — see enforcementTier in premium/entitlements.mjs and
   * commandContext.mjs. The service must treat it as a targeting hint, not
   * as proof of payment.
   */
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
    ...(taskShardId ? { shardId: taskShardId } : {}),
    environment: process.env.NODE_ENV ?? 'development',
  }
}
