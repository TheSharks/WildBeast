import { ApplyOptions } from '@sapphire/decorators'
import type { ListenerOptions } from '@sapphire/framework'
import { Listener } from '@sapphire/framework'
import { metrics } from '@thesharks/analytics'
import { type RateLimitData, RESTEvents } from 'discord.js'

const meter = metrics.getMeter('@thesharks/discord')
const rateLimitCounter = meter.createCounter(
  'discord_rest_rate_limited_total',
  {
    description: 'Discord REST requests that hit a rate limit',
  },
)

@ApplyOptions<ListenerOptions>({
  emitter: 'rest',
  event: RESTEvents.RateLimited,
})
export class RestRateLimitedListener extends Listener {
  public run(rateLimitInfo: RateLimitData): void {
    rateLimitCounter.add(1, {
      // The bucket route (e.g. /channels/:id/messages), not the raw URL, so
      // cardinality stays bounded.
      route: rateLimitInfo.route,
      method: rateLimitInfo.method,
      global: String(rateLimitInfo.global),
    })
    this.container.logger.warn(
      `REST rate limit hit: ${rateLimitInfo.method} ${rateLimitInfo.route} ` +
        `(global: ${rateLimitInfo.global}, retry after ${rateLimitInfo.retryAfter}ms)`,
    )
  }
}
