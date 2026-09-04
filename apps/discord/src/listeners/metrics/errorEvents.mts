import { ApplyOptions } from '@sapphire/decorators'
import type { ListenerOptions } from '@sapphire/framework'
import { Events, Listener } from '@sapphire/framework'
import { metrics } from '@thesharks/analytics'
import type { ClientEvents } from 'discord.js'

const meter = metrics.getMeter('@thesharks/discord')
const warnCounter = meter.createCounter('discord_warnings_total', {
  description: 'Total number of Discord warnings',
})
const errorCounter = meter.createCounter('discord_errors_total', {
  description: 'Total number of Discord errors',
})

// Pieces default their name to the file name; multiple listeners in one file
// need explicit names or each insert unloads the previous one.
@ApplyOptions<ListenerOptions>({
  name: 'warnMetrics',
  event: Events.Warn,
})
export class WarnListener extends Listener {
  public run(...[message]: ClientEvents['warn']): void {
    // The message text goes to logs; a metric label with free-form text would
    // create a new time series per unique message.
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
