import type { ScheduledTask } from '@sapphire/plugin-scheduled-tasks'
import { metrics } from '@thesharks/analytics'
import { AppScheduledTask } from '../structures/task.mjs'

const meter = metrics.getMeter('@thesharks/discord')
// Labels frozen by METRIC_CONTRACT['discord_entitlement_reconcile_total'].
const reconcileCounter = meter.createCounter(
  'discord_entitlement_reconcile_total',
  { description: 'Entitlement mirror reconciliations by result' },
)
// Labels frozen by METRIC_CONTRACT['discord_entitlement_backfill_errors_total'].
const failureCounter = meter.createCounter(
  'discord_entitlement_backfill_errors_total',
  { description: 'Entitlement snapshot failures by outcome' },
)

/**
 * Periodic full entitlement snapshot; keeps background premium decisions
 * fresh. App-global, so shard 0's worker runs it. The boot listener enqueues
 * a one-off run so a restart never waits a full interval.
 */
export class EntitlementRefreshTask extends AppScheduledTask {
  public constructor(
    context: ScheduledTask.LoaderContext,
    options: ScheduledTask.Options,
  ) {
    super(context, {
      ...options,
      interval: 6 * 60 * 60 * 1000,
      requiresShard: 0,
    })
  }

  public async run() {
    const app = this.container.app
    if (app.config.premiumSkus.size === 0) {
      this.container.logger.debug(
        'No premium SKUs configured; skipping entitlement snapshot',
      )
      return
    }
    let result: Awaited<ReturnType<typeof app.entitlements.synchronize>>
    try {
      result = await app.entitlements.synchronize(app.work.signal)
    } catch (error) {
      // The queue retries; the mirror only backs background decisions.
      failureCounter.add(1, { outcome: 'retry' })
      throw error
    }
    reconcileCounter.add(1, { result: result.kind })
    this.container.logger.info(
      result.kind === 'completed'
        ? `Entitlement snapshot completed: ${result.count} entitlement(s)`
        : 'Entitlement snapshot superseded by concurrent writes; the next run retries',
    )
  }
}

declare module '@sapphire/plugin-scheduled-tasks' {
  interface ScheduledTasks {
    entitlementRefresh: never
  }
}
