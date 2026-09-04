import { ApplyOptions } from '@sapphire/decorators'
import type { ListenerOptions } from '@sapphire/framework'
import { Listener } from '@sapphire/framework'
import { metrics } from '@thesharks/analytics'
import type { Client } from 'discord.js'
import { Events } from 'discord.js'
import { premiumSkuMap } from '../../premium/skus.mjs'
import { reconcileEntitlements } from '../../premium/sync.mjs'

const meter = metrics.getMeter('@thesharks/discord')
/** Failed backfill attempts by terminal outcome, for outage dashboards. */
export const entitlementBackfillErrorCounter = meter.createCounter(
  'discord_entitlement_backfill_errors_total',
  { description: 'Entitlement backfill failures by outcome' },
)

/** Backoff between reconcile attempts; exported so tests stay fast by
 * injecting shorter delays. */
export const BACKFILL_RETRY_DELAYS_MS = [1_000, 2_000]
export const BACKFILL_MAX_ATTEMPTS = 1 + BACKFILL_RETRY_DELAYS_MS.length

export function backfillDelays(
  delays: readonly number[] = BACKFILL_RETRY_DELAYS_MS,
): readonly number[] {
  return delays
}

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })

/**
 * Reconcile the entitlement mirror against Discord's API once on boot, to
 * catch grants/revocations that happened while the bot was offline. The
 * gateway listeners (entitlementSync.mts) take over from there. Retries
 * transient API failures with backoff; a failed mirror only degrades
 * background checks, so the run still never throws.
 *
 * When no premium SKUs are configured the run is skipped, but the check
 * happens on every ClientReady (not cached) so configuring SKUs later and
 * reconnecting re-triggers the backfill without a code change.
 */
@ApplyOptions<ListenerOptions>({
  event: Events.ClientReady,
  once: true,
})
export class EntitlementBackfillListener extends Listener {
  public async run(
    client: Client<true>,
    options: {
      delays?: readonly number[]
      sleep?: (ms: number) => Promise<void>
    } = {},
  ) {
    if (premiumSkuMap().size === 0) {
      this.container.logger.debug(
        'No premium SKUs configured, skipping entitlement backfill; will re-trigger on a later ClientReady once SKUs appear',
      )
      return
    }
    // Entitlements are app-global, not shard-affine: one worker reconciling
    // is enough. Shard 0 exists in every topology.
    if (!client.ws.shards.has(0)) return

    const delays = options.delays ?? backfillDelays()
    const wait = options.sleep ?? sleep
    let attempt = 0
    for (;;) {
      try {
        const live = await reconcileEntitlements(client)
        this.container.logger.info(
          `Entitlement mirror reconciled: ${live} live entitlement(s)`,
        )
        return
      } catch (error) {
        // The mirror only backs non-interaction checks; interaction-time
        // premium checks read fresh data regardless.
        if (attempt >= delays.length) {
          try {
            entitlementBackfillErrorCounter.add(1, { outcome: 'exhausted' })
          } catch {
            // Metrics must never break boot.
          }
          this.container.logger.warn(
            `Could not reconcile entitlements after ${attempt + 1} attempt(s), giving up until the next event or reboot`,
            error,
          )
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
