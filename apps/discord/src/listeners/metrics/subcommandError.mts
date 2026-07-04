import { Listener } from '@sapphire/framework'
import { type Attributes, metrics, resolveShardId } from '@thesharks/analytics'
import type { ClientEvents } from 'discord.js'

const meter = metrics.getMeter('@thesharks/discord')
const errorCounter = meter.createCounter('discord_command_errors_total', {
  description: 'Total number of Discord command errors',
})

/**
 * Subcommand-based commands don't emit chatInputCommandError; the
 * subcommands plugin emits its own event, so they need their own listener
 * to land in the same metrics.
 */
export class SubcommandErrorListener extends Listener {
  public constructor(
    context: Listener.LoaderContext,
    options: Listener.Options,
  ) {
    super(context, {
      ...options,
      event: 'chatInputSubcommandError',
    })
  }

  public run(...[, payload]: ClientEvents['chatInputSubcommandError']) {
    const shardId = resolveShardId(payload.interaction, this)
    const labels: Attributes = {
      command: payload.command?.name,
      subcommand: payload.matchedSubcommandMapping.name,
      shard_id: shardId,
      scope: payload.interaction.inGuild() ? 'guild' : 'dm',
    }
    errorCounter.add(1, labels)
  }
}
