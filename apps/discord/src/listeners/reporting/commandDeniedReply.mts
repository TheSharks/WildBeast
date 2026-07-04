import { ApplyOptions } from '@sapphire/decorators'
import type { ListenerOptions, UserError } from '@sapphire/framework'
import { Events, Identifiers, Listener } from '@sapphire/framework'
import { resolveKey } from '@sapphire/plugin-i18next'
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
    const content = await this.localize(interaction, error)
    if (interaction.replied || interaction.deferred) {
      return interaction.editReply(content)
    }
    return interaction.reply({
      content,
      flags: MessageFlags.Ephemeral,
    })
  }

  private async localize(
    interaction: ClientEvents['chatInputCommandDenied'][1]['interaction'],
    error: UserError,
  ): Promise<string> {
    if (error.identifier === Identifiers.PreconditionCooldown) {
      const remaining = Number(
        Reflect.get(Object(error.context), 'remaining') ?? 0,
      )
      return (await resolveKey(interaction, 'system/errors:cooldown', {
        resumeAt: `<t:${Math.ceil((Date.now() + remaining) / 1000)}:R>`,
      })) as string
    }
    // Other precondition messages are framework-provided English; they
    // gain localized keys as preconditions get used.
    return error.message
  }
}
