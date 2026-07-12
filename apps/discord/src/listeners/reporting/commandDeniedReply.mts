import { ApplyOptions } from '@sapphire/decorators'
import type { ListenerOptions, UserError } from '@sapphire/framework'
import { Events, Identifiers, Listener } from '@sapphire/framework'
import { resolveKey } from '@sapphire/plugin-i18next'
import {
  type ActionRowBuilder,
  type ButtonBuilder,
  type ChatInputCommandInteraction,
  type ClientEvents,
  type ContextMenuCommandInteraction,
  MessageFlags,
} from 'discord.js'
import { FeaturePreconditionIdentifier } from '../../preconditions/Feature.mjs'
import { OwnerOnlyPreconditionIdentifier } from '../../preconditions/OwnerOnly.mjs'
import { PremiumPreconditionIdentifier } from '../../preconditions/Premium.mjs'
import { isPremiumTier } from '../../premium/tiers.mjs'
import { premiumUpsellComponents } from '../../premium/upsell.mjs'

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
  name: 'chatInputCommandDeniedReply',
  event: Events.ChatInputCommandDenied,
})
export class CommandDeniedReplyListener extends Listener {
  public async run(
    ...[error, payload]: ClientEvents['chatInputCommandDenied']
  ) {
    return replyToDenial(payload.interaction, error)
  }
}

@ApplyOptions<ListenerOptions>({
  name: 'contextMenuCommandDeniedReply',
  event: Events.ContextMenuCommandDenied,
})
export class ContextMenuCommandDeniedReplyListener extends Listener {
  public async run(
    ...[error, payload]: ClientEvents['contextMenuCommandDenied']
  ) {
    return replyToDenial(payload.interaction, error)
  }
}

type DeniedInteraction =
  | ChatInputCommandInteraction
  | ContextMenuCommandInteraction

async function replyToDenial(interaction: DeniedInteraction, error: UserError) {
  // Preconditions can opt out of user feedback.
  if (Reflect.get(Object(error.context), 'silent')) return

  const reply = await describeDenial(interaction, error)
  if (interaction.replied || interaction.deferred) {
    return interaction.editReply(reply)
  }
  return interaction.reply({ ...reply, flags: MessageFlags.Ephemeral })
}

async function describeDenial(
  interaction: DeniedInteraction,
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
  if (error.identifier === OwnerOnlyPreconditionIdentifier) {
    return {
      content: (await resolveKey(
        interaction,
        'system/errors:owner_only',
      )) as string,
    }
  }
  if (error.identifier === PremiumPreconditionIdentifier) {
    const context = Object(error.context)
    const required = String(Reflect.get(context, 'requiredTier') ?? 'premium')
    const scope = Reflect.get(context, 'requiredScope')
    return {
      content: (await resolveKey(
        interaction,
        'system/errors:premium_required',
      )) as string,
      components: premiumUpsellComponents(
        isPremiumTier(required) ? required : 'premium',
        scope === 'user' || scope === 'guild' ? scope : 'any',
      ),
    }
  }
  // Other precondition messages are framework-provided English; they gain
  // localized keys as preconditions get used.
  return { content: error.message }
}
