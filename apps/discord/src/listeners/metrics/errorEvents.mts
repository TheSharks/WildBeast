import { ApplyOptions } from '@sapphire/decorators'
import type { ListenerOptions } from '@sapphire/framework'
import { Events, Listener } from '@sapphire/framework'
import { metrics } from '@thesharks/analytics'
import type { ClientEvents } from 'discord.js'

const meter = metrics.getMeter('@thesharks/discord')
// Labels frozen by METRIC_CONTRACT['discord_warnings_total'] in
// packages/analytics/src/utils/metrics.ts.
const warnCounter = meter.createCounter('discord_warnings_total', {
  description: 'Total number of Discord warnings',
})
// Labels frozen by METRIC_CONTRACT['discord_errors_total'] in
// packages/analytics/src/utils/metrics.ts.
const errorCounter = meter.createCounter('discord_errors_total', {
  description: 'Total number of Discord errors',
})

// Explicit names prevent same-file listeners unloading each other.
@ApplyOptions<ListenerOptions>({
  name: 'warnMetrics',
  event: Events.Warn,
})
export class WarnListener extends Listener {
  public run(...[message]: ClientEvents['warn']): void {
    // Keep free-form text out of labels to bound cardinality.
    warnCounter.add(1, { error_type: 'warning' })
    this.container.logger.warn(`Discord client warning: ${message}`)
  }
}

@ApplyOptions<ListenerOptions>({
  name: 'errorMetrics',
  event: Events.Error,
})
export class ErrorListener extends Listener {
  public run(...[error]: ClientEvents['error']): void {
    errorCounter.add(1, {
      error_type: error?.name ?? 'unknown',
    })
    this.container.logger.error('Discord client error:', error)
  }
}
