import { ApplyOptions } from '@sapphire/decorators'
import type { ListenerOptions } from '@sapphire/framework'
import { Listener } from '@sapphire/framework'
import { metrics } from '@thesharks/analytics'
import type { Client } from 'discord.js'
import { Events } from 'discord.js'
import { premiumSkuMap } from '../../premium/skus.mjs'
import { reconcileEntitlements } from '../../premium/sync.mjs'

const meter = metrics.getMeter('@thesharks/discord')
// Backfill failures by outcome.
export const entitlementBackfillErrorCounter = meter.createCounter(
  'discord_entitlement_backfill_errors_total',
  { description: 'Entitlement backfill failures by outcome' },
)

// Backoff between attempts; exported for fast tests.
export const BACKFILL_RETRY_DELAYS_MS = [1_000, 2_000]
export const BACKFILL_MAX_ATTEMPTS = 1 + BACKFILL_RETRY_DELAYS_MS.length
// Deferred re-attempt once immediate retries are spent; keeps a revoked mirror from going stale.
export const BACKFILL_RESCHEDULE_DELAY_MS = 5 * 60 * 1_000

export function backfillDelays(
  delays: readonly number[] = BACKFILL_RETRY_DELAYS_MS,
): readonly number[] {
  return delays
}

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })

// Boot backfill for offline grants/revokes; gateway listeners take over after. Retries transient failures.
// Skipped without SKUs; re-checked every ClientReady so late config still triggers it.
@ApplyOptions<ListenerOptions>({
  event: Events.ClientReady,
  // Every ClientReady re-triggers, so a failed boot backfill retries on the next reconnect.
  once: false,
})
export class EntitlementBackfillListener extends Listener {
  public async run(
    client: Client<true>,
    options: {
      delays?: readonly number[]
      sleep?: (ms: number) => Promise<void>
      rescheduleDelay?: number
      schedule?: (ms: number, task: () => void) => void
    } = {},
  ) {
    if (premiumSkuMap().size === 0) {
      this.container.logger.debug(
        'No premium SKUs configured, skipping entitlement backfill; will re-trigger on a later ClientReady once SKUs appear',
      )
      return
    }
    // Entitlements are app-global; shard 0 alone reconciles.
    if (!client.ws.shards.has(0)) return

    const delays = options.delays ?? backfillDelays()
    const wait = options.sleep ?? sleep
    const rescheduleDelay =
      options.rescheduleDelay ?? BACKFILL_RESCHEDULE_DELAY_MS
    const schedule =
      options.schedule ??
      ((ms: number, task: () => void) => {
        const timer = setTimeout(task, ms)
        // Never hold the process open for a background retry.
        timer.unref?.()
      })
    let attempt = 0
    for (;;) {
      try {
        const live = await reconcileEntitlements(client)
        this.container.logger.info(
          `Entitlement mirror reconciled: ${live} live entitlement(s)`,
        )
        return
      } catch (error) {
        // Mirror only backs background checks; interactions read fresh data.
        if (attempt >= delays.length) {
          try {
            entitlementBackfillErrorCounter.add(1, { outcome: 'exhausted' })
          } catch {
            // Metrics must never break boot.
          }
          this.container.logger.warn(
            `Could not reconcile entitlements after ${attempt + 1} attempt(s), retrying in the background`,
            error,
          )
          // Reschedule beyond the immediate attempts; each rerun retries again, staying periodic until success.
          schedule(rescheduleDelay, () => {
            void this.run(client, {
              delays,
              sleep: wait,
              rescheduleDelay,
              schedule,
            })
          })
          return
        }
        try {
          entitlementBackfillErrorCounter.add(1, { outcome: 'retry' })
        } catch {
          // ignore
        }
        this.container.logger.warn(
          `Entitlement backfill attempt ${attempt + 1} failed, retrying`,
          error,
        )
        await wait(delays[attempt]!)
        attempt += 1
      }
    }
  }
}
