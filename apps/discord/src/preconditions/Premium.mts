import { Precondition } from '@sapphire/framework'
import type {
  BaseInteraction,
  ChatInputCommandInteraction,
  ContextMenuCommandInteraction,
} from 'discord.js'
import {
  subjectFromInteraction,
  tierEnforced,
} from '../features/evaluation.mjs'
import {
  type PremiumScope,
  type PremiumTier,
  tierAtLeast,
} from '../premium/tiers.mjs'

// Denial identifier for the localized upsell in commandDeniedReply.
export const PremiumPreconditionIdentifier = 'preconditionPremium'

export interface PremiumPreconditionContext extends Precondition.Context {
  /** Minimum tier required to run the command. Defaults to 'premium'. */
  tier?: PremiumTier
  /** Whose subscription satisfies the gate; 'guild' always denies in DMs. */
  scope?: PremiumScope | 'any'
}

// Gate a command behind a tier; capped-but-usable commands use `limitFor` instead.
// Sapphire skips preconditions for autocomplete/components, so guard those via gates.mjs too.
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
    const { requiredTier, requiredScope } = resolvePremiumRequirement(context)
    const currentTier = tierEnforced(
      subjectFromInteraction(interaction),
      requiredScope,
    )
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

// Effective tier + scope for a precondition context.
export function resolvePremiumRequirement(
  context: PremiumPreconditionContext = {},
): { requiredTier: PremiumTier; requiredScope: PremiumScope | 'any' } {
  return {
    requiredTier: context.tier ?? 'premium',
    requiredScope: context.scope ?? 'any',
  }
}

// Scope-resolved tier under the same rule the precondition enforces.
export function premiumTierForInteraction(
  interaction: BaseInteraction,
  context: PremiumPreconditionContext = {},
): PremiumTier {
  return tierEnforced(
    subjectFromInteraction(interaction),
    resolvePremiumRequirement(context).requiredScope,
  )
}

// Synchronous gate check (entitlements ride the interaction); for autocomplete and component re-checks.
export function isPremiumSatisfied(
  interaction: BaseInteraction,
  context: PremiumPreconditionContext = {},
): boolean {
  const { requiredTier, requiredScope } = resolvePremiumRequirement(context)
  return tierAtLeast(
    tierEnforced(subjectFromInteraction(interaction), requiredScope),
    requiredTier,
  )
}

// Readability alias of isPremiumSatisfied.
export const requirePremium = isPremiumSatisfied

// Autocomplete guard; true when the body may run (preconditions never cover autocomplete).
export function premiumAutocompleteAllowed(
  interaction: BaseInteraction,
  context: PremiumPreconditionContext = {},
): boolean {
  return isPremiumSatisfied(interaction, context)
}

// Component re-check; components outlive the invocation that created them.
export function premiumComponentAllowed(
  interaction: BaseInteraction,
  context: PremiumPreconditionContext = {},
): boolean {
  return isPremiumSatisfied(interaction, context)
}

declare module '@sapphire/framework' {
  interface Preconditions {
    Premium: PremiumPreconditionContext
  }
}
