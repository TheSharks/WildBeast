import type { Client } from 'discord.js'
import type { CommandIdRepository } from '../adapters/command-ids-postgres.mjs'
import type { Experiments } from '../features/experiments.mjs'
import type { FeatureFlags } from '../features/flags.mjs'
import type { CommandGates } from '../features/gates.mjs'
import type { OperatorCommands } from '../operators/service.mjs'
import type {
  EntitlementSynchronizer,
  PremiumService,
} from '../premium/service.mjs'
import type { PremiumTagLimits } from '../premium/tag-limits.mjs'
import type { TagReconciler } from '../tags/reconciler.mjs'
import type { TagService } from '../tags/service.mjs'
import type { AppConfig } from './config.mjs'
import type { WorkScope } from './work.mjs'

/** Everything a Sapphire piece may reach; services never reach back into pieces. */
export interface AppServices {
  config: AppConfig
  work: WorkScope
  flags: FeatureFlags
  gates: CommandGates
  experiments: Experiments
  premium: PremiumService
  entitlements: EntitlementSynchronizer
  tags: TagService
  tagLimits: PremiumTagLimits
  tagReconciler: TagReconciler
  commandIds: CommandIdRepository
  operatorCommands: OperatorCommands
  /** Names promoted tags may not shadow. */
  reservedCommandNames(): ReadonlySet<string>
}

/** A logged-in client, or an error when a piece runs before login completes. */
export function readyClient(client: Client): Client<true> {
  if (!client.isReady()) throw new Error('Discord client is not ready')
  return client
}

declare module '@sapphire/framework' {
  interface Container {
    app: AppServices
  }
}
