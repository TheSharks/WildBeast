import { ApplyOptions } from '@sapphire/decorators'
import type { ListenerOptions } from '@sapphire/framework'
import { Listener } from '@sapphire/framework'
import type { Client } from 'discord.js'
import { Events } from 'discord.js'

/**
 * Grants can change while the bot is offline. Every ClientReady on the shard 0
 * worker enqueues one snapshot so a restart or reconnect never waits for the
 * periodic run; the queue retries it if this worker cannot serve it.
 */
@ApplyOptions<ListenerOptions>({ event: Events.ClientReady, once: false })
export class EntitlementBootListener extends Listener {
  public async run(client: Client<true>) {
    const app = this.container.app
    if (app.config.premiumSkus.size === 0 || !client.ws.shards.has(0)) return
    try {
      await this.container.tasks.create('entitlementRefresh', {
        repeated: false,
        delay: 0,
        customJobOptions: { jobId: `entitlementRefresh:boot:${Date.now()}` },
      })
    } catch (error) {
      this.container.logger.warn(
        'Could not enqueue the boot entitlement snapshot; the periodic run covers it',
        error,
      )
    }
  }
}
