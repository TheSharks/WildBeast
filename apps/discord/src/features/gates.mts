import type { Command } from '@sapphire/framework'
import type { AutocompleteInteraction, BaseInteraction } from 'discord.js'
import type { PremiumPreconditionContext } from '../preconditions/Premium.mjs'
import { tierAtLeast } from '../premium/tiers.mjs'
import {
  evaluateGates,
  type GatePremiumRequirement,
  isAllowed,
  premiumRequirementFor,
  registerPremiumGate,
  subjectFromInteraction,
  tierEnforced,
} from './evaluation.mjs'
import { commandGateKey } from './registry.mjs'

// Registered premium requirement, if any.
export function premiumGateFor(
  command: string,
): PremiumPreconditionContext | undefined {
  const requirement = premiumRequirementFor(command)
  return requirement as PremiumPreconditionContext | undefined
}

// Gate check; true when the command has no requirement.
export function commandPremiumAllowed(
  interaction: BaseInteraction,
  command: string,
): boolean {
  const requirement = premiumRequirementFor(command)
  if (!requirement) return true
  const tier = requirement.tier ?? 'premium'
  const scope = requirement.scope ?? 'any'
  return tierAtLeast(
    tierEnforced(subjectFromInteraction(interaction), scope),
    tier,
  )
}

// Subcommand for flag targeting; only chat/autocomplete interactions carry one.
function subcommandOf(interaction: BaseInteraction): string | undefined {
  try {
    if (
      typeof interaction.isChatInputCommand === 'function' &&
      interaction.isChatInputCommand()
    ) {
      return interaction.options.getSubcommand(false) ?? undefined
    }
    if (
      typeof interaction.isAutocomplete === 'function' &&
      interaction.isAutocomplete()
    ) {
      return interaction.options.getSubcommand(false) ?? undefined
    }
  } catch {
    return undefined
  }
  return undefined
}

// Gate command invocations and suppress autocomplete work while disabled.
export function installCommandFeatureGate(command: Command): void {
  const key = commandGateKey(command.name)
  if (!key) return
  command.preconditions.append({ name: 'Feature', context: { key } })

  const autocompleteRun = command.autocompleteRun?.bind(command)
  if (!autocompleteRun) return
  command.autocompleteRun = async (interaction) => {
    const evaluation = await evaluateGates(
      subjectFromInteraction(interaction),
      command.name,
      subcommandOf(interaction),
    )
    return evaluation.flagEnabled
      ? autocompleteRun(interaction)
      : interaction.respond([])
  }
}

// Kill switch for components, which outlive invocations; also re-checks the premium gate.
export async function commandComponentEnabled(
  interaction: BaseInteraction,
  command: string,
): Promise<boolean> {
  const evaluation = await evaluateGates(
    subjectFromInteraction(interaction),
    command,
  )
  return isAllowed(evaluation)
}

// Premium-gate a command with autocomplete + component coverage (preconditions cover neither).
export function installCommandPremiumGate(
  command: Command,
  context: PremiumPreconditionContext = {},
): void {
  registerPremiumGate(command.name, context as GatePremiumRequirement)
  command.preconditions.append({ name: 'Premium', context })

  const autocompleteRun = command.autocompleteRun?.bind(command)
  if (!autocompleteRun) return
  command.autocompleteRun = async (interaction: AutocompleteInteraction) => {
    const evaluation = await evaluateGates(
      subjectFromInteraction(interaction),
      command.name,
      subcommandOf(interaction),
    )
    if (!evaluation.premiumAllowed) {
      return interaction.respond([])
    }
    return autocompleteRun(interaction)
  }
}

// Premium-only component re-check; prefer commandComponentEnabled when both gates apply.
export function premiumComponentAllowed(
  interaction: BaseInteraction,
  command: string,
): boolean {
  return commandPremiumAllowed(interaction, command)
}
