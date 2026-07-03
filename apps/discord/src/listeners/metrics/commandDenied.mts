import { ApplyOptions } from '@sapphire/decorators'
import type { ListenerOptions } from '@sapphire/framework'
import { Events, Listener } from '@sapphire/framework'
import { metrics, resolveShardId } from '@thesharks/analytics'
import type { ClientEvents } from 'discord.js'

const meter = metrics.getMeter('@thesharks/discord')
const deniedCounter = meter.createCounter('discord_command_denied_total', {
  description:
    'Commands blocked by preconditions (permissions, cooldowns, ...)',
})

// Pieces default their name to the file name; multiple listeners in one file
// need explicit names or each insert unloads the previous one.
@ApplyOptions<ListenerOptions>({
  name: 'chatInputDeniedMetrics',
  event: Events.ChatInputCommandDenied,
})
export class ChatInputCommandDeniedListener extends Listener {
  public run(
    ...[error, payload]: ClientEvents['chatInputCommandDenied']
  ): void {
    deniedCounter.add(1, {
      command: payload.command.name,
      // The precondition identifier (e.g. Cooldown, UserPermissions) — a
      // small bounded set, unlike the human-readable message.
      identifier: error.identifier,
      scope: payload.interaction.inGuild() ? 'guild' : 'dm',
      shard_id: resolveShardId(payload.interaction, this),
    })
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
    deniedCounter.add(1, {
      command: payload.command.name,
      identifier: error.identifier,
      scope: payload.interaction.inGuild() ? 'guild' : 'dm',
      shard_id: resolveShardId(payload.interaction, this),
    })
    this.container.logger.debug(
      `Context menu command ${payload.command.name} denied: ${error.identifier}`,
    )
  }
}
