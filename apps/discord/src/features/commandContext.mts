import type { EvaluationContext } from '@openfeature/server-sdk'
import type { BaseInteraction } from 'discord.js'
import { enforcementTier } from '../premium/entitlements.mjs'
import type { PremiumScope } from '../premium/tiers.mjs'
import { interactionFlagContext } from './context.mjs'
import { subjectFromInteraction, tierAny, tierEnforced } from './evaluation.mjs'

export { enforcementTier }

// Command-surface flag context; tier is anyTier for targeting only (limits use tierEnforced).
// CHECK: user subs must not lift guild caps; evaluation.mts owns that split.
export function commandFlagContext(
  interaction: BaseInteraction,
  command: string,
): EvaluationContext {
  return interactionFlagContext(interaction, {
    command,
    subcommand: subcommandOf(interaction),
    tier: tierAny(subjectFromInteraction(interaction)),
  })
}

// Scope-resolved tier for limits; guild scope is free in DMs.
export function limitEnforcementTier(
  interaction: BaseInteraction,
  scope: PremiumScope | 'any',
) {
  return tierEnforced(subjectFromInteraction(interaction), scope)
}

function subcommandOf(interaction: BaseInteraction): string | undefined {
  if (interaction.isChatInputCommand() || interaction.isAutocomplete()) {
    return interaction.options.getSubcommand(false) ?? undefined
  }
  return undefined
}
