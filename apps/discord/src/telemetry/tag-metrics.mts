import { metrics } from '@thesharks/analytics'

const meter = metrics.getMeter('@thesharks/discord')
// Labels frozen by METRIC_CONTRACT['discord_guild_tag_command_promotions_total'].
export const promotionsCounter = meter.createCounter(
  'discord_guild_tag_command_promotions_total',
  { description: 'Guild tag command promotions and demotions' },
)
// Labels frozen by METRIC_CONTRACT['discord_guild_tag_reconcile_deferred_total'].
export const reconcileDeferCounter = meter.createCounter(
  'discord_guild_tag_reconcile_deferred_total',
  {
    description:
      'Guild tag reconciliations deferred on stale entitlement mirror',
  },
)

export interface RepairCounts {
  created: number
  recovered: number
  removed: number
  deferred: boolean
  policyError?: unknown
}

/** Attribute a repair pass to the trigger that ran it. */
export function recordRepair(
  result: RepairCounts,
  trigger: 'command' | 'reconcile',
): void {
  const promoted = result.created + result.recovered
  if (promoted > 0)
    promotionsCounter.add(promoted, { action: 'promote', trigger })
  if (result.removed > 0)
    promotionsCounter.add(result.removed, { action: 'demote', trigger })
  if (result.deferred) {
    reconcileDeferCounter.add(1, {
      reason:
        result.policyError !== undefined ? 'policy-error' : 'stale-mirror',
    })
  }
}
