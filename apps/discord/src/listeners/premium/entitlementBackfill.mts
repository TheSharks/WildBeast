import { ApplyOptions } from '@sapphire/decorators'
import type { ListenerOptions } from '@sapphire/framework'
import { Listener } from '@sapphire/framework'
import type { Client } from 'discord.js'
import { Events } from 'discord.js'
import { premiumSkuMap } from '../../premium/skus.mjs'
import { reconcileEntitlements } from '../../premium/sync.mjs'

/**
 * Reconcile the entitlement mirror against Discord's API once on boot, to
 * catch grants/revocations that happened while the bot was offline. The
 * gateway listeners (entitlementSync.mts) take over from there.
 */
@ApplyOptions<ListenerOptions>({
  event: Events.ClientReady,
  once: true,
})
export class EntitlementBackfillListener extends Listener {
  public async run(client: Client<true>) {
    if (premiumSkuMap().size === 0) {
      this.container.logger.debug(
        'No premium SKUs configured, skipping entitlement backfill',
      )
      return
    }
    // Entitlements are app-global, not shard-affine: one worker reconciling
    // is enough. Shard 0 exists in every topology.
    if (!client.ws.shards.has(0)) return

    try {
      const live = await reconcileEntitlements(client)
      this.container.logger.info(
        `Entitlement mirror reconciled: ${live} live entitlement(s)`,
      )
    } catch (error) {
      // The mirror only backs non-interaction checks; interaction-time
      // premium checks read fresh data regardless.
      this.container.logger.warn('Could not reconcile entitlements', error)
    }
  }
}
