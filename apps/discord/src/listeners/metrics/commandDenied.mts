import { ApplyOptions } from '@sapphire/decorators'
import type { ListenerOptions } from '@sapphire/framework'
import { Events, Listener } from '@sapphire/framework'
import { metrics } from '@thesharks/analytics'
import type { ClientEvents } from 'discord.js'
import { commandMetricLabels } from '../../utils/tracing.mjs'

const meter = metrics.getMeter('@thesharks/discord')
// Labels frozen by METRIC_CONTRACT['discord_command_denied_total'] in
// packages/analytics/src/utils/metrics.ts.
const deniedCounter = meter.createCounter('discord_command_denied_total', {
  description:
    'Commands blocked by preconditions (permissions, cooldowns, ...)',
})

// Explicit names prevent same-file listeners unloading each other.
@ApplyOptions<ListenerOptions>({
  name: 'chatInputDeniedMetrics',
  event: Events.ChatInputCommandDenied,
})
export class ChatInputCommandDeniedListener extends Listener {
  public run(
    ...[error, payload]: ClientEvents['chatInputCommandDenied']
  ): void {
    deniedCounter.add(
      1,
      commandMetricLabels(payload.interaction, payload.command.name, this, {
        // Bounded precondition id, not free-form message.
        identifier: error.identifier,
      }),
    )
    this.container.logger.debug(
      `Command ${payload.command.name} denied: ${error.identifier}`,
    )
  }
}

@ApplyOptions<ListenerOptions>({
  name: 'contextMenuDeniedMetrics',
  event: Events.ContextMenuCommandDenied,
})
export class ContextMenuCommandDeniedListener extends Listener {
  public run(
    ...[error, payload]: ClientEvents['contextMenuCommandDenied']
  ): void {
    deniedCounter.add(
      1,
      commandMetricLabels(payload.interaction, payload.command.name, this, {
        identifier: error.identifier,
      }),
    )
    this.container.logger.debug(
      `Context menu command ${payload.command.name} denied: ${error.identifier}`,
    )
  }
}
