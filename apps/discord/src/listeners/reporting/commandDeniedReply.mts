import { ApplyOptions } from '@sapphire/decorators'
import type { ListenerOptions, UserError } from '@sapphire/framework'
import { Events, Identifiers, Listener } from '@sapphire/framework'
import { resolveKey } from '@sapphire/plugin-i18next'
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type ClientEvents,
  MessageFlags,
} from 'discord.js'
import { FeaturePreconditionIdentifier } from '../../preconditions/Feature.mjs'
import { PremiumPreconditionIdentifier } from '../../preconditions/Premium.mjs'
import { skuIdForTier } from '../../premium/skus.mjs'
import { isPremiumTier } from '../../premium/tiers.mjs'

interface DenialReply {
  content: string
  components?: ActionRowBuilder<ButtonBuilder>[]
}

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
    const reply = await this.describe(interaction, error)
    if (interaction.replied || interaction.deferred) {
      return interaction.editReply(reply)
    }
    return interaction.reply({
      ...reply,
      flags: MessageFlags.Ephemeral,
    })
  }

  private async describe(
    interaction: ClientEvents['chatInputCommandDenied'][1]['interaction'],
    error: UserError,
  ): Promise<DenialReply> {
    if (error.identifier === Identifiers.PreconditionCooldown) {
      const remaining = Number(
        Reflect.get(Object(error.context), 'remaining') ?? 0,
      )
      return {
        content: (await resolveKey(interaction, 'system/errors:cooldown', {
          resumeAt: `<t:${Math.ceil((Date.now() + remaining) / 1000)}:R>`,
        })) as string,
      }
    }
    if (error.identifier === FeaturePreconditionIdentifier) {
      return {
        content: (await resolveKey(
          interaction,
          'system/errors:feature_unavailable',
        )) as string,
      }
    }
    if (error.identifier === PremiumPreconditionIdentifier) {
      const context = Object(error.context)
      const required = String(Reflect.get(context, 'requiredTier') ?? 'premium')
      const scope = Reflect.get(context, 'requiredScope')
      // A premium-style button opens Discord's purchase flow for the SKU
      // that grants the missing tier; without a configured SKU the denial
      // is just informational.
      const skuId = skuIdForTier(
        isPremiumTier(required) ? required : 'premium',
        scope === 'user' || scope === 'guild' ? scope : 'any',
      )
      return {
        content: (await resolveKey(
          interaction,
          'system/errors:premium_required',
        )) as string,
        components: skuId
          ? [
              new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                  .setStyle(ButtonStyle.Premium)
                  .setSKUId(skuId),
              ),
            ]
          : undefined,
      }
    }
    // Other precondition messages are framework-provided English; they
    // gain localized keys as preconditions get used.
    return { content: error.message }
  }
}
