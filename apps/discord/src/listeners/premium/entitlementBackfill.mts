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
    // Entitlements are app-global; shard 0 alone reconciles.
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
        // Mirror only backs background checks; interactions read fresh data.
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
