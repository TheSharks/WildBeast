import { Precondition } from '@sapphire/framework'
import type {
  BaseInteraction,
  ChatInputCommandInteraction,
  ContextMenuCommandInteraction,
} from 'discord.js'
import { enforcementTier } from '../premium/entitlements.mjs'
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
 *
 * Sapphire only runs preconditions for command invocations, not for
 * autocomplete or later component clicks. Commands that gate here must
 * also guard those surfaces via installCommandPremiumGate (features/gates.mjs)
 * or the requirePremium helpers below, or autocomplete leaks gated work and
 * stale buttons outlive a lapsed subscription.
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
    const { requiredTier, requiredScope } = resolvePremiumRequirement(context)
    const currentTier = enforcementTier(interaction, requiredScope)
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

/** Normalize a precondition context to its effective tier + scope. */
export function resolvePremiumRequirement(
  context: PremiumPreconditionContext = {},
): { requiredTier: PremiumTier; requiredScope: PremiumScope | 'any' } {
  return {
    requiredTier: context.tier ?? 'premium',
    requiredScope: context.scope ?? 'any',
  }
}

/**
 * The scope-resolved tier for a premium gate — the same rule the
 * precondition enforces. A 'guild' gate reads the guild subscription (free
 * in DMs, so it always denies there); 'user' reads the invoker's own;
 * 'any' takes the best of either.
 */
export function premiumTierForInteraction(
  interaction: BaseInteraction,
  context: PremiumPreconditionContext = {},
): PremiumTier {
  return enforcementTier(
    interaction,
    resolvePremiumRequirement(context).requiredScope,
  )
}

/**
 * Whether `interaction` satisfies the premium gate. Synchronous — Discord
 * attaches fresh entitlements to every interaction. The primary helper for
 * autocomplete suppression and component re-checks (features/gates.mjs);
 * `requirePremium` is the same check under the name call sites read best.
 */
export function isPremiumSatisfied(
  interaction: BaseInteraction,
  context: PremiumPreconditionContext = {},
): boolean {
  const { requiredTier, requiredScope } = resolvePremiumRequirement(context)
  return tierAtLeast(enforcementTier(interaction, requiredScope), requiredTier)
}

/** Alias of isPremiumSatisfied for call-site readability. */
export const requirePremium = isPremiumSatisfied

/**
 * Autocomplete guard mirroring the Feature pattern: Sapphire never runs
 * command preconditions for autocomplete, so gated commands must suppress
 * their own suggestion work or disabled users hit databases/APIs as they
 * type. Returns true when the autocomplete body may run.
 */
export function premiumAutocompleteAllowed(
  interaction: BaseInteraction,
  context: PremiumPreconditionContext = {},
): boolean {
  return isPremiumSatisfied(interaction, context)
}

/**
 * Component re-check mirroring commandComponentEnabled: components outlive
 * the invocation that created them, so button/select handlers must re-verify
 * the gate instead of trusting the original precondition run.
 */
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
