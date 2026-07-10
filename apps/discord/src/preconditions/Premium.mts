import { Precondition } from '@sapphire/framework'
import type {
  ChatInputCommandInteraction,
  ContextMenuCommandInteraction,
} from 'discord.js'
import {
  guildTierForInteraction,
  tierForInteraction,
  userTierForInteraction,
} from '../premium/entitlements.mjs'
import {
  type PremiumScope,
  type PremiumTier,
  tierAtLeast,
} from '../premium/tiers.mjs'

/** Identifier carried by denial errors; commandDeniedReply.mts branches on
 * it to show the localized upsell. Named after Sapphire's own convention
 * (preconditionCooldown, ...). */
export const PremiumPreconditionIdentifier = 'preconditionPremium'

export interface PremiumPreconditionContext extends Precondition.Context {
  /** Minimum tier required to run the command. Defaults to 'premium'. */
  tier?: PremiumTier
  /**
   * Whose subscription satisfies the gate: the invoker's own ('user'), the
   * current guild's ('guild'), or either ('any', the default). A 'guild'
   * gate always denies in DMs.
   */
  scope?: PremiumScope | 'any'
}

/**
 * Gate a whole command behind a premium tier:
 *
 *   preconditions: ['Premium']
 *   preconditions: [{ name: 'Premium', context: { tier: 'premium', scope: 'guild' } }]
 *
 * For commands that stay usable on the free tier but with a cap, don't gate
 * here — read the cap via `limitFor` (premium/entitlements.mjs) instead.
 */
export class PremiumPrecondition extends Precondition {
  public override chatInputRun(
    interaction: ChatInputCommandInteraction,
    _command: unknown,
    context: PremiumPreconditionContext,
  ) {
    return this.check(interaction, context)
  }

  public override contextMenuRun(
    interaction: ContextMenuCommandInteraction,
    _command: unknown,
    context: PremiumPreconditionContext,
  ) {
    return this.check(interaction, context)
  }

  private check(
    interaction: ChatInputCommandInteraction | ContextMenuCommandInteraction,
    context: PremiumPreconditionContext,
  ) {
    const requiredTier = context.tier ?? 'premium'
    const requiredScope = context.scope ?? 'any'
    const currentTier = {
      user: userTierForInteraction,
      guild: guildTierForInteraction,
      any: tierForInteraction,
    }[requiredScope](interaction)
    if (tierAtLeast(currentTier, requiredTier)) {
      return this.ok()
    }
    return this.error({
      identifier: PremiumPreconditionIdentifier,
      message: 'This command requires a premium subscription.',
      context: { ...context, requiredTier, requiredScope, currentTier },
    })
  }
}

declare module '@sapphire/framework' {
  interface Preconditions {
    Premium: PremiumPreconditionContext
  }
}
