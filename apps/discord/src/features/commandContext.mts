import type { EvaluationContext } from '@openfeature/server-sdk'
import type { BaseInteraction } from 'discord.js'
import {
  enforcementTier,
  tierForInteraction,
} from '../premium/entitlements.mjs'
import type { PremiumScope } from '../premium/tiers.mjs'
import { interactionFlagContext } from './context.mjs'

export { enforcementTier }

// Command-surface flag context; build here so targeting stays uniform.
// CHECK: `tier` is anyTier for targeting only, never for limits (user subs must not lift guild caps).
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

// Scope-resolved tier for limits; guild scope is free in DMs.
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
