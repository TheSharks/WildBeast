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
import { denialReason } from '../../features/evaluation.mjs'
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
  // Single gate vocabulary; identifiers map to an evaluation slice below.
  const reason = denialReason({
    flagEnabled: error.identifier !== FeaturePreconditionIdentifier,
    premiumAllowed: error.identifier !== PremiumPreconditionIdentifier,
  })
  if (reason === 'feature') {
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
  if (reason === 'premium') {
    const context = Object(error.context)
    const required = String(Reflect.get(context, 'requiredTier') ?? 'premium')
    const rawScope = Reflect.get(context, 'requiredScope')
    const scope = rawScope === 'user' || rawScope === 'guild' ? rawScope : 'any'
    const tier = isPremiumTier(required) ? required : 'premium'
    const base = (await resolveKey(
      interaction,
      'system/errors:premium_required',
      { tier, scope },
    )) as string
    return {
      content: `${base} ${premiumDenialDetail(interaction, tier, scope)}`,
      components: premiumUpsellComponents(tier, scope, interaction.guildId),
    }
  }
  // Other precondition messages are framework-provided English; they gain
  // localized keys as preconditions get used.
  return { content: error.message }
}

/**
 * Scope-aware denial detail appended to the localized premium_required
 * base: who needs the subscription and at which tier/scope. Guild gates
 * name the server; user gates name the invoker; 'any' names both. A guild
 * gate in DMs can never pass, so say so explicitly. Exported for tests.
 */
export function premiumDenialDetail(
  interaction: Pick<DeniedInteraction, 'guildId'>,
  tier: string,
  scope: 'user' | 'guild' | 'any',
): string {
  if (scope === 'guild') {
    if (!interaction.guildId) {
      return `This command needs ${tier} for a server and can't be used in DMs (guild scope).`
    }
    return `This server needs ${tier} (guild scope) to use this command.`
  }
  if (scope === 'user') {
    return `You need ${tier} (user scope) to use this command.`
  }
  if (!interaction.guildId) {
    return `You need ${tier} to use this command.`
  }
  return `You or this server need ${tier} to use this command.`
}
