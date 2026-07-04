import { ApplyOptions } from '@sapphire/decorators'
import type { ListenerOptions } from '@sapphire/framework'
import { Events, Listener } from '@sapphire/framework'
import { type ClientEvents, MessageFlags } from 'discord.js'

/**
 * Tell the user why a precondition (cooldown, permissions, ...) blocked
 * their command; without this the interaction just times out. The metrics
 * counterpart lives in metrics/commandDenied.mts.
 */
@ApplyOptions<ListenerOptions>({
  event: Events.ChatInputCommandDenied,
})
export class CommandDeniedReplyListener extends Listener {
  public async run(
    ...[error, payload]: ClientEvents['chatInputCommandDenied']
  ) {
    // Preconditions can opt out of user feedback.
    if (Reflect.get(Object(error.context), 'silent')) return

    const { interaction } = payload
    if (interaction.replied || interaction.deferred) {
      return interaction.editReply(error.message)
    }
    return interaction.reply({
      content: error.message,
      flags: MessageFlags.Ephemeral,
    })
  }
}
