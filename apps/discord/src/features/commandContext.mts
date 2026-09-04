import type { EvaluationContext } from '@openfeature/server-sdk'
import type { BaseInteraction } from 'discord.js'
import {
  enforcementTier,
  tierForInteraction,
} from '../premium/entitlements.mjs'
import type { PremiumScope } from '../premium/tiers.mjs'
import { interactionFlagContext } from './context.mjs'

export { enforcementTier }

/**
 * The evaluation context for command-surface flags: gates, autocomplete
 * suppression, and experiments. Every command call site must build its
 * context here so targeting attributes stay uniform — a hand-rolled
 * context that forgets `tier` or `subcommand` doesn't fail, it just
 * silently stops matching the service's rules.
 *
 * Lives apart from context.mts because tier resolution comes from
 * premium/entitlements.mjs, which itself imports context.mjs.
 *
 * `tier` here is the anyTier (best of the invoker's user subscription and
 * the guild subscription) for gate targeting. It must NOT drive limit
 * enforcement: a user subscription must never lift a guild-scoped cap.
 * Limit evaluation resolves its own scope-resolved tier via
 * enforcementTier (re-exported above) — limitFor does this internally.
 */
export function commandFlagContext(
  interaction: BaseInteraction,
  command: string,
): EvaluationContext {
  return interactionFlagContext(interaction, {
    command,
    subcommand: subcommandOf(interaction),
    tier: tierForInteraction(interaction),
  })
}

/**
 * Scope-resolved tier for limit enforcement. Thin wrapper over the premium
 * helper so limit call sites import one context module: pass the limit's
 * registry scope, get whose subscription counts. Guild scope is free in
 * DMs by construction.
 */
export function limitEnforcementTier(
  interaction: BaseInteraction,
  scope: PremiumScope | 'any',
) {
  return enforcementTier(interaction, scope)
}

function subcommandOf(interaction: BaseInteraction): string | undefined {
  if (interaction.isChatInputCommand() || interaction.isAutocomplete()) {
    return interaction.options.getSubcommand(false) ?? undefined
  }
  return undefined
}
